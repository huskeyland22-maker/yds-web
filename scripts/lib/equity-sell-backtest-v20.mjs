/**
 * US single-stock hold-versus-sell study v20 (research only).
 *
 * Compares selling at the correction close with holding afterward.
 * Hold returns are measured from that close. The 60-session window stays
 * the existing episode window. No sell rule is selected.
 */

import { mean, median, spearman } from "./equity-sell-backtest-v2.mjs"
import { t0Bucket } from "./equity-sell-backtest-v4.mjs"
import { leaveOneCorrelation } from "./equity-sell-backtest-v7.mjs"
import { hitDay } from "./equity-sell-backtest-v11.mjs"
import {
  SELECTED_STRATEGY as V19_SELECTED_STRATEGY,
  assertBaseline,
  attachRegime,
  attachSplit,
  loadOhlcv,
  selectMildEvents,
} from "./equity-sell-backtest-v19.mjs"

export { assertBaseline, attachRegime, attachSplit, loadOhlcv, selectMildEvents, t0Bucket }

export const SELECTED_STRATEGY = null
export const BOOTSTRAP = 10000
export const HORIZONS = [
  ["t0", 0],
  ["t1", 1],
  ["t3", 3],
  ["t5", 5],
  ["t10", 10],
  ["t20", 20],
  ["t40", 40],
  ["window", null],
]
const HOLD_KEYS = ["t1", "t3", "t5", "t10", "t20", "t40", "window"]
const RECOVERY = [
  ["3", 0.03],
  ["5", 0.05],
  ["10", 0.1],
  ["15", 0.15],
  ["20", 0.2],
]

function finite(value) {
  return Number.isFinite(value)
}

function round2(value) {
  return finite(value) ? Math.round(value * 100) / 100 : null
}

function round4(value) {
  return finite(value) ? Math.round(value * 10000) / 10000 : null
}

function pct(value) {
  return finite(value) ? round2(value * 100) : null
}

function dateIndex(dates, date) {
  let lo = 0
  let hi = dates.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (dates[mid] === date) return mid
    if (dates[mid] < date) lo = mid + 1
    else hi = mid - 1
  }
  return -1
}

function quantile(values, p) {
  const xs = values.filter(finite).sort((a, b) => a - b)
  if (!xs.length) return null
  const index = (xs.length - 1) * p
  const lo = Math.floor(index)
  const hi = Math.ceil(index)
  if (lo === hi) return xs[lo]
  return xs[lo] * (hi - index) + xs[hi] * (index - lo)
}

function share(flags) {
  if (!flags.length) return null
  return round2((flags.filter(Boolean).length / flags.length) * 100)
}

export function buildHold(closes, episodeIdx, t0Idx) {
  const entry = closes[t0Idx]
  const windowIdx = episodeIdx + 60
  if (!(entry > 0) || t0Idx < episodeIdx || windowIdx >= closes.length) return null
  const retAt = (idx) => (idx >= 0 && idx < closes.length ? closes[idx] / entry - 1 : null)
  const point = {}
  for (const [key, offset] of HORIZONS) {
    if (key === "t0") point[key] = 0
    else if (key === "window") point[key] = retAt(windowIdx)
    else point[key] = retAt(t0Idx + offset)
  }
  if (point.t40 != null && point.window != null && t0Idx + 40 === windowIdx && point.t40 !== point.window) {
    throw new Error("T+40 and the window landed on the same close but differ")
  }
  const through = (lastIdx) => {
    let min = null
    let plus5 = false
    let plus10 = false
    let plus20 = false
    const stop = Math.min(lastIdx, closes.length - 1)
    const plus20Stop = Math.min(stop, windowIdx)
    for (let k = t0Idx + 1; k <= stop; k++) {
      const value = closes[k] / entry - 1
      if (min == null || value < min) min = value
      if (value + 1e-12 >= 0.05) plus5 = true
      if (value + 1e-12 >= 0.1) plus10 = true
      if (k <= plus20Stop && value + 1e-12 >= 0.2) plus20 = true
    }
    return { min, plus5, plus10, plus20 }
  }
  const horizonPath = {}
  for (const [key, offset] of HORIZONS) {
    if (key === "t0") continue
    const last = key === "window" ? windowIdx : t0Idx + offset
    horizonPath[key] = point[key] == null ? null : through(last)
  }
  let lowIdx = null
  let lowClose = null
  for (let k = t0Idx + 1; k <= windowIdx; k++) {
    if (lowClose == null || closes[k] < lowClose) {
      lowClose = closes[k]
      lowIdx = k
    }
  }
  const lowDay = lowIdx == null ? null : lowIdx - t0Idx
  const fromLow = {}
  for (const offset of [5, 10, 20]) {
    const idx = lowIdx == null ? null : lowIdx + offset
    fromLow[`t${offset}`] = idx == null || idx > windowIdx ? null : closes[idx] / lowClose - 1
  }
  fromLow.window = lowClose == null ? null : closes[windowIdx] / lowClose - 1
  const hits = {}
  for (const [key, target] of RECOVERY) {
    const days = lowIdx == null ? null : hitDay(closes, lowIdx, windowIdx, target)
    hits[key] = { reached: days != null, days }
  }
  return {
    returns: point,
    path: horizonPath,
    minReturn: horizonPath.window?.min ?? null,
    lowDay,
    lowTo: fromLow,
    hits,
    windowIdx,
    t40Idx: t0Idx + 40,
  }
}

export function attachHold(events, seriesBySymbol) {
  const out = events.map((event) => {
    const series = seriesBySymbol.get(event.ticker)
    if (!series) throw new Error(`missing series ${event.ticker}`)
    const episodeIdx = dateIndex(series.dates, event.episodeStart)
    const t0Idx = dateIndex(series.dates, event.t0Date)
    if (episodeIdx < 0 || t0Idx < 0) throw new Error(`missing dates ${event.eventId}`)
    const hold = buildHold(series.closes, episodeIdx, t0Idx)
    if (!hold) throw new Error(`hold path missing ${event.eventId}`)
    if (event.lowDay != null && hold.lowDay !== event.lowDay) throw new Error(`low day changed ${event.eventId}`)
    if (finite(event.lowToWindow) && Math.abs(hold.lowTo.window - event.lowToWindow) > 1e-8) {
      throw new Error(`low-to-window changed ${event.eventId}`)
    }
    if (hold.t40Idx === hold.windowIdx && hold.returns.t40 !== hold.returns.window) {
      throw new Error(`T+40 replaced the window ${event.eventId}`)
    }
    return { ...event, hold }
  })
  out.bandCounts = events.bandCounts
  return out
}

function level(values) {
  const xs = values.filter(finite)
  return {
    n: xs.length,
    mean: pct(xs.length ? mean(xs) : null),
    median: pct(xs.length ? median(xs) : null),
    winRate: share(xs.map((value) => value > 0)),
    lossRate: share(xs.map((value) => value < 0)),
  }
}

function horizonBlock(events, key) {
  const rows = events.filter((event) => finite(event.hold.returns[key]))
  const base = level(rows.map((event) => event.hold.returns[key]))
  if (key === "t0") return { ...base, sellNow: 0 }
  const path = rows.map((event) => event.hold.path[key]).filter(Boolean)
  return {
    ...base,
    holdAdvantageMean: base.mean,
    holdAdvantageMedian: base.median,
    worse5: share(path.map((row) => row.min <= -0.05)),
    worse10: share(path.map((row) => row.min <= -0.1)),
    hit5: share(path.map((row) => row.plus5)),
    hit10: share(path.map((row) => row.plus10)),
    hit20: share(path.map((row) => row.plus20)),
  }
}

function bandTable(events) {
  const out = {}
  for (const band of ["LOW", "MID", "HIGH"]) {
    const rows = events.filter((event) => event.atrBand === band)
    const horizons = {}
    for (const [key] of HORIZONS) {
      horizons[key] = key === "t0"
        ? { ...level(rows.map((event) => event.t0)), sellNow: 0 }
        : horizonBlock(rows, key)
    }
    horizons.t0Stored = horizons.t0
    const mins = rows.map((event) => event.hold.minReturn).filter(finite)
    horizons.minimum = {
      n: mins.length,
      mean: pct(mins.length ? mean(mins) : null),
      median: pct(mins.length ? median(mins) : null),
      p5: pct(quantile(mins, 0.05)),
      p25: pct(quantile(mins, 0.25)),
      worse5: share(mins.map((value) => value <= -0.05)),
      worse10: share(mins.map((value) => value <= -0.1)),
      worse15: share(mins.map((value) => value <= -0.15)),
      worse20: share(mins.map((value) => value <= -0.2)),
    }
    const lowRows = rows.filter((event) => event.hold.lowDay != null)
    horizons.lowTo = {}
    for (const key of ["t5", "t10", "t20", "window"]) {
      horizons.lowTo[key] = level(lowRows.map((event) => event.hold.lowTo[key]))
    }
    horizons.recovery = {}
    for (const [key] of RECOVERY) {
      const eligible = lowRows.length
      const days = lowRows.map((event) => event.hold.hits[key].days).filter(finite)
      horizons.recovery[key] = {
        eligible,
        reached: days.length,
        hitRate: eligible ? round2((days.length / eligible) * 100) : null,
        meanDays: days.length ? round2(mean(days)) : null,
        medianDays: days.length ? round2(median(days)) : null,
        conclusion: eligible < 10 ? "결론 금지" : eligible < 20 ? "수치만" : "제한적",
      }
    }
    horizons.firstPositive = {
      mean: HOLD_KEYS.find((key) => finite(horizons[key].mean) && horizons[key].mean > 0) ?? null,
      median: HOLD_KEYS.find((key) => finite(horizons[key].median) && horizons[key].median > 0) ?? null,
      winRate: HOLD_KEYS.find((key) => finite(horizons[key].winRate) && horizons[key].winRate > 50) ?? null,
    }
    out[band] = { n: rows.length, ...horizons }
  }
  return out
}

function gap(high, low) {
  if (!finite(high) || !finite(low)) return null
  return round2(high - low)
}

function valuesOf(events, band, read) {
  return events.filter((event) => event.atrBand === band).map(read).filter(finite)
}

function mulberry32(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function resample(values, random) {
  const out = []
  for (let i = 0; i < values.length; i++) out.push(values[Math.floor(random() * values.length)])
  return out
}

export function bootstrapDiff(high, low, trials, seed) {
  if (high.length < 2 || low.length < 2) return null
  const actual = mean(high) - mean(low)
  const random = mulberry32(seed)
  const boots = []
  for (let trial = 0; trial < trials; trial++) boots.push(mean(resample(high, random)) - mean(resample(low, random)))
  boots.sort((a, b) => a - b)
  const pool = [...high, ...low]
  let extreme = 0
  for (let trial = 0; trial < trials; trial++) {
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      const swap = pool[i]
      pool[i] = pool[j]
      pool[j] = swap
    }
    const diff = mean(pool.slice(0, high.length)) - mean(pool.slice(high.length))
    if (Math.abs(diff) >= Math.abs(actual)) extreme += 1
  }
  return {
    nHigh: high.length,
    nLow: low.length,
    meanDiff: pct(actual),
    medianDiff: pct(median(high) - median(low)),
    ci95: [pct(boots[Math.floor(0.025 * trials)]), pct(boots[Math.ceil(0.975 * trials) - 1])],
    permutationTail: round4(extreme / trials),
  }
}

function residualGap(events, read) {
  const rows = events.map((event) => ({ y: read(event), t0: event.t0, band: event.atrBand })).filter((row) => finite(row.y) && finite(row.t0))
  if (rows.length < 3) return null
  const mx = mean(rows.map((row) => row.t0))
  const my = mean(rows.map((row) => row.y))
  let num = 0
  let den = 0
  for (const row of rows) {
    num += (row.t0 - mx) * (row.y - my)
    den += (row.t0 - mx) ** 2
  }
  const slope = den === 0 ? 0 : num / den
  const intercept = my - slope * mx
  const meanOf = (band) => {
    const chosen = rows.filter((row) => row.band === band).map((row) => row.y - (intercept + slope * row.t0))
    return chosen.length ? mean(chosen) : null
  }
  const high = meanOf("HIGH")
  const low = meanOf("LOW")
  return pct(finite(high) && finite(low) ? high - low : null)
}

function cell(events) {
  const stats = {
    n: events.length,
    conclusion: events.length < 10 ? "결론 금지" : events.length < 20 ? "수치만" : "제한적",
  }
  for (const key of ["t5", "t10", "t20", "window"]) stats[key] = level(events.map((event) => event.hold.returns[key])).mean
  stats.lowToWindow = level(events.map((event) => event.hold.lowTo.window)).mean
  const lows = events.filter((event) => event.hold.lowDay != null)
  const reached = lows.filter((event) => event.hold.hits["10"].reached).length
  stats.hit10 = lows.length ? round2((reached / lows.length) * 100) : null
  return stats
}

function leadershipGrid(events) {
  const out = {}
  for (const leadership of ["HIGH", "LOW"]) {
    out[leadership] = {}
    for (const atr of ["HIGH", "LOW"]) {
      out[leadership][atr] = cell(events.filter((event) => event.leadershipGroup === leadership && event.atrBand === atr))
    }
  }
  return out
}

function t0Grid(events) {
  const buckets = ["lt0", "b0", "b5", "b10", "b15", "ge20"]
  const out = {}
  for (const bucket of buckets) {
    const rows = events.filter((event) => t0Bucket(event.t0) === bucket)
    out[bucket] = {
      n: rows.length,
      high: rows.filter((event) => event.atrBand === "HIGH").length,
      low: rows.filter((event) => event.atrBand === "LOW").length,
      conclusion: rows.length < 10 ? "결론 금지" : "제한적",
    }
  }
  return out
}

function continuous(events) {
  const readX = (event) => event.predictors.atrPct
  const links = [
    ["t5", (event) => event.hold.returns.t5],
    ["t10", (event) => event.hold.returns.t10],
    ["t20", (event) => event.hold.returns.t20],
    ["t40", (event) => event.hold.returns.t40],
    ["window", (event) => event.hold.returns.window],
    ["lowT10", (event) => event.hold.lowTo.t10],
    ["lowT20", (event) => event.hold.lowTo.t20],
    ["lowWindow", (event) => event.hold.lowTo.window],
    ["hit10", (event) => (event.hold.hits["10"].reached ? event.hold.hits["10"].days : null)],
  ]
  return Object.fromEntries(links.map(([key, readY]) => {
    const link = spearman(events.map((event) => ({ x: readX(event), y: readY(event) })))
    return [key, { n: link.n, spearman: link.rho }]
  }))
}

function tickerRobust(events) {
  const windowRead = (event) => event.hold.returns.window
  const eventLink = spearman(events.map((event) => ({ x: event.predictors.atrPct, y: windowRead(event) })))
  const groups = new Map()
  for (const event of events) {
    if (!finite(windowRead(event)) || !finite(event.predictors.atrPct)) continue
    const group = groups.get(event.ticker) ?? { x: [], y: [] }
    group.x.push(event.predictors.atrPct)
    group.y.push(windowRead(event))
    groups.set(event.ticker, group)
  }
  const points = [...groups].map(([, group]) => ({ x: mean(group.x), y: mean(group.y) }))
  const tickerLink = spearman(points)
  const leave = leaveOneCorrelation(events.filter((event) => finite(windowRead(event))), (event) => event.predictors.atrPct, windowRead)
  const gapOf = (rows) => {
    const high = valuesOf(rows, "HIGH", windowRead)
    const low = valuesOf(rows, "LOW", windowRead)
    return high.length && low.length ? mean(high) - mean(low) : null
  }
  const baseGap = gapOf(events)
  const tickers = [...new Set(events.map((event) => event.ticker))]
  const gaps = tickers.map((ticker) => gapOf(events.filter((event) => event.ticker !== ticker))).filter(finite)
  return {
    eventWeighted: { n: eventLink.n, spearman: eventLink.rho },
    tickerWeighted: { tickers: points.length, spearman: tickerLink.rho, maxEvents: Math.max(...[...groups].map(([, group]) => group.y.length)) },
    leaveOneTicker: {
      baseline: leave.baseline.rho,
      min: leave.min,
      max: leave.max,
      median: leave.median,
      signFlips: leave.signFlips,
    },
    holdGap: {
      baseline: pct(baseGap),
      min: pct(Math.min(...gaps)),
      max: pct(Math.max(...gaps)),
      median: pct(median(gaps)),
      signFlips: gaps.filter((value) => Math.sign(value) !== Math.sign(baseGap) && value !== 0).length,
    },
    withinStock: "결론 금지",
  }
}

export function judgeHold(input) {
  const better = (key) => finite(input.gap[key]) && input.gap[key] > 0
  const rebound = finite(input.lowWindowGap) && input.lowWindowGap > 0
  const win = ["t10", "t20", "window"].every((key) => finite(input.highWin[key]) && input.highWin[key] > 50)
  const fatTail = (finite(input.extraDrop15) && input.extraDrop15 >= 15) || (finite(input.extraDrop20) && input.extraDrop20 >= 10)
  const excessive = fatTail || (finite(input.extraDropGap) && input.extraDropGap >= 15 && finite(input.minMedianGap) && input.minMedianGap <= -3)
  const loo = finite(input.looMin) && input.looMin > 0
  if (better("t10") && better("t20") && better("window") && rebound && win && !excessive && loo) {
    return { label: "강하게 지지" }
  }
  const wins = ["t10", "t20", "window"].filter((key) => better(key)).length
  if (wins === 0) return { label: "확인 실패" }
  return { label: "부분적으로 지지" }
}

export function study(events, options = {}) {
  if (V19_SELECTED_STRATEGY !== null || SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  assertBaseline(events)
  if (events.bandCounts.LOW !== 34 || events.bandCounts.MID !== 34 || events.bandCounts.HIGH !== 35) {
    throw new Error("ATR groups changed")
  }
  const trials = options.bootstrap ?? BOOTSTRAP
  const bands = bandTable(events)
  const highLow = {}
  for (const key of ["t5", "t10", "t20", "t40", "window"]) {
    highLow[key] = {
      mean: gap(bands.HIGH[key].mean, bands.LOW[key].mean),
      median: gap(bands.HIGH[key].median, bands.LOW[key].median),
      winRate: gap(bands.HIGH[key].winRate, bands.LOW[key].winRate),
    }
  }
  const lowWindowGap = gap(bands.HIGH.lowTo.window.mean, bands.LOW.lowTo.window.mean)
  const t0Means = {
    HIGH: bands.HIGH.t0Stored.mean,
    MID: bands.MID.t0Stored.mean,
    LOW: bands.LOW.t0Stored.mean,
  }
  const controlled = {}
  for (const key of ["t5", "t10", "t20", "window"]) controlled[key] = residualGap(events, (event) => event.hold.returns[key])
  const links = continuous(events)
  const robust = tickerRobust(events)
  const boot = {}
  const reads = {
    t5: (event) => event.hold.returns.t5,
    t10: (event) => event.hold.returns.t10,
    t20: (event) => event.hold.returns.t20,
    window: (event) => event.hold.returns.window,
    lowWindow: (event) => event.hold.lowTo.window,
  }
  let seed = 20261020
  for (const [key, read] of Object.entries(reads)) {
    boot[key] = bootstrapDiff(valuesOf(events, "HIGH", read), valuesOf(events, "LOW", read), trials, seed)
    seed += 17
  }
  const judgment = judgeHold({
    gap: { t10: highLow.t10.mean, t20: highLow.t20.mean, window: highLow.window.mean },
    lowWindowGap,
    highWin: { t10: bands.HIGH.t10.winRate, t20: bands.HIGH.t20.winRate, window: bands.HIGH.window.winRate },
    extraDropGap: gap(bands.HIGH.minimum.worse10, bands.LOW.minimum.worse10),
    extraDrop15: gap(bands.HIGH.minimum.worse15, bands.LOW.minimum.worse15),
    extraDrop20: gap(bands.HIGH.minimum.worse20, bands.LOW.minimum.worse20),
    minMedianGap: gap(bands.HIGH.minimum.median, bands.LOW.minimum.median),
    looMin: robust.holdGap.min,
  })
  return {
    selectedStrategy: SELECTED_STRATEGY,
    bands,
    highLow,
    lowWindowGap,
    t0Means,
    t0ControlledGap: controlled,
    t0Buckets: t0Grid(events),
    leadership: leadershipGrid(events),
    continuous: links,
    robust,
    bootstrap: boot,
    v19Direction: {
      lowWindowSpearman: links.lowWindow.spearman,
      holdWindowSpearman: links.window.spearman,
      sameSign: finite(links.lowWindow.spearman) && finite(links.window.spearman) && Math.sign(links.lowWindow.spearman) === Math.sign(links.window.spearman) && links.lowWindow.spearman !== 0,
    },
    judgment,
  }
}
