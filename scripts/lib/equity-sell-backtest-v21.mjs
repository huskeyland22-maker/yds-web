/**
 * US single-stock risk-adjusted hold study v21 (research only).
 *
 * Compares the rebound after a correction close with the further decline
 * along the way. No sell rule is selected. v1–v20 files are not modified.
 */

import { mean, median, spearman } from "./equity-sell-backtest-v2.mjs"
import { leaveOneCorrelation, sampleStdev } from "./equity-sell-backtest-v7.mjs"
import {
  SELECTED_STRATEGY as V20_SELECTED_STRATEGY,
  assertBaseline,
  attachHold,
  attachRegime,
  attachSplit,
  loadOhlcv,
  selectMildEvents,
} from "./equity-sell-backtest-v20.mjs"

export { assertBaseline, attachHold, attachRegime, attachSplit, loadOhlcv, selectMildEvents }

export const SELECTED_STRATEGY = null
export const BOOTSTRAP = 10000
const HORIZONS = ["t1", "t3", "t5", "t10", "t20", "t40", "window"]
const RECOVERY = ["3", "5", "10", "15", "20"]
const MAE_BUCKETS = [
  ["gt5", "MAE > -5%", (value) => value > -0.05],
  ["m5", "-5% to -10%", (value) => value <= -0.05 && value > -0.1],
  ["m10", "-10% to -15%", (value) => value <= -0.1 && value > -0.15],
  ["m15", "-15% to -20%", (value) => value <= -0.15 && value > -0.2],
  ["le20", "MAE <= -20%", (value) => value <= -0.2],
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

function conclusion(n) {
  if (n < 10) return "결론 금지"
  if (n < 20) return "수치만"
  return "제한적"
}

function gap(high, low) {
  if (!finite(high) || !finite(low)) return null
  return round2(high - low)
}

export function maeBucket(mae) {
  if (!finite(mae)) return null
  const found = MAE_BUCKETS.find(([, , test]) => test(mae))
  return found ? found[0] : null
}

export function ratioOf(gain, mae) {
  if (!finite(gain) || !finite(mae) || Math.abs(mae) < 1e-12) return null
  return gain / Math.abs(mae)
}

export function excursion(closes, episodeIdx, t0Idx) {
  const entry = closes[t0Idx]
  const windowIdx = episodeIdx + 60
  if (!(entry > 0) || t0Idx < episodeIdx || windowIdx >= closes.length) return null
  let mae = null
  let mfe = null
  for (let k = t0Idx + 1; k <= windowIdx; k++) {
    const value = closes[k] / entry - 1
    if (mae == null || value < mae) mae = value
    if (mfe == null || value > mfe) mfe = value
  }
  const window = closes[windowIdx] / entry - 1
  const lowClose = mae == null ? null : entry * (1 + mae)
  return {
    mae,
    mfe,
    window,
    lowDepth: mae,
    lowToWindow: lowClose == null ? null : closes[windowIdx] / lowClose - 1,
    t40: t0Idx + 40 < closes.length ? closes[t0Idx + 40] / entry - 1 : null,
    windowIdx,
    t40Idx: t0Idx + 40,
  }
}

export function attachRisk(events, seriesBySymbol) {
  const out = events.map((event) => {
    const series = seriesBySymbol.get(event.ticker)
    if (!series) throw new Error(`missing series ${event.ticker}`)
    const episodeIdx = dateIndex(series.dates, event.episodeStart)
    const t0Idx = dateIndex(series.dates, event.t0Date)
    const path = excursion(series.closes, episodeIdx, t0Idx)
    if (!path) throw new Error(`risk path missing ${event.eventId}`)
    if (finite(event.hold?.minReturn) && Math.abs(path.mae - event.hold.minReturn) > 1e-8) {
      throw new Error(`MAE drifted from v20 ${event.eventId}`)
    }
    if (event.hold?.minReturn == null && path.mae != null) throw new Error(`MAE filled a v20 gap ${event.eventId}`)
    if (finite(event.hold?.lowTo?.window) && Math.abs(path.lowToWindow - event.hold.lowTo.window) > 1e-8) {
      throw new Error(`low-to-window drifted ${event.eventId}`)
    }
    if (path.t40Idx === path.windowIdx && path.t40 !== path.window) throw new Error(`T+40 replaced the window ${event.eventId}`)
    const mae = event.hold.minReturn
    const window = event.hold.returns.window
    const lowToWindow = event.hold.lowTo.window
    const ratio = ratioOf(window, mae)
    const efficiency = ratioOf(window - mae, mae)
    const reboundPerDepth = ratioOf(lowToWindow, mae)
    return {
      ...event,
      risk: {
        mae,
        mfe: path.mfe,
        window,
        lowDepth: mae,
        lowToWindow,
        t40: event.hold.returns.t40,
        ratio,
        efficiency,
        reboundPerDepth,
        bucket: maeBucket(mae),
        depth: mae == null ? null : mae <= -0.1 ? "DEEP" : "SHALLOW",
      },
    }
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

function shape(values, points, scale) {
  const xs = values.filter(finite)
  const show = scale === "ratio" ? round2 : pct
  const out = {
    n: xs.length,
    mean: xs.length ? show(mean(xs)) : null,
    median: xs.length ? show(median(xs)) : null,
  }
  for (const [name, p] of points) out[name] = xs.length ? show(quantile(xs, p)) : null
  return out
}

function read(rows, pick) {
  return rows.map(pick)
}

function bandBlock(rows) {
  const maeValues = read(rows, (event) => event.risk.mae)
  const winners = rows.filter((event) => event.risk.window > 0 && finite(event.risk.mae))
  const horizons = {}
  for (const key of HORIZONS) {
    const present = rows.filter((event) => finite(event.hold.returns[key]) && event.hold.path[key])
    const mins = present.map((event) => event.hold.path[key].min).filter(finite)
    horizons[key] = {
      ...level(present.map((event) => event.hold.returns[key])),
      maeN: mins.length,
      maeMean: pct(mins.length ? mean(mins) : null),
      maeMedian: pct(mins.length ? median(mins) : null),
      worse5: share(mins.map((value) => value <= -0.05)),
      worse10: share(mins.map((value) => value <= -0.1)),
      worse15: share(mins.map((value) => value <= -0.15)),
    }
  }
  return {
    n: rows.length,
    window: level(read(rows, (event) => event.risk.window)),
    mae: shape(maeValues, [["p5", 0.05], ["p25", 0.25], ["p75", 0.75]]),
    mfe: shape(read(rows, (event) => event.risk.mfe), [["p75", 0.75], ["p95", 0.95]]),
    lowDepth: shape(read(rows, (event) => event.risk.lowDepth), []),
    lowToWindow: level(read(rows, (event) => event.risk.lowToWindow)),
    ratio: shape(read(rows, (event) => event.risk.ratio), [], "ratio"),
    efficiency: shape(read(rows, (event) => event.risk.efficiency), [], "ratio"),
    reboundPerDepth: shape(read(rows, (event) => event.risk.reboundPerDepth), [], "ratio"),
    positiveWindowAdverse: {
      denominator: winners.length,
      denominatorNote: "events with Window > 0 and an observed MAE",
      worse5: share(winners.map((event) => event.risk.mae <= -0.05)),
      worse10: share(winners.map((event) => event.risk.mae <= -0.1)),
      worse15: share(winners.map((event) => event.risk.mae <= -0.15)),
      worse20: share(winners.map((event) => event.risk.mae <= -0.2)),
    },
    horizons,
    zeroMae: rows.filter((event) => finite(event.risk.mae) && Math.abs(event.risk.mae) < 1e-12).length,
  }
}

function drawdownBuckets(events) {
  return MAE_BUCKETS.map(([id, label, test]) => {
    const rows = events.filter((event) => finite(event.risk.mae) && test(event.risk.mae))
    return {
      id,
      label,
      n: rows.length,
      conclusion: conclusion(rows.length),
      bands: {
        LOW: rows.filter((event) => event.atrBand === "LOW").length,
        MID: rows.filter((event) => event.atrBand === "MID").length,
        HIGH: rows.filter((event) => event.atrBand === "HIGH").length,
      },
      window: level(read(rows, (event) => event.risk.window)),
      lowToWindow: level(read(rows, (event) => event.risk.lowToWindow)).mean,
    }
  })
}

function cellStats(rows) {
  const lows = rows.filter((event) => event.hold.lowDay != null)
  const reached = lows.filter((event) => event.hold.hits["10"].reached).length
  return {
    n: rows.length,
    conclusion: conclusion(rows.length),
    window: level(read(rows, (event) => event.risk.window)).mean,
    t10: level(read(rows, (event) => event.hold.returns.t10)).mean,
    t20: level(read(rows, (event) => event.hold.returns.t20)).mean,
    lowToWindow: level(read(rows, (event) => event.risk.lowToWindow)).mean,
    hit10: lows.length ? round2((reached / lows.length) * 100) : null,
    mae: level(read(rows, (event) => event.risk.mae)).mean,
  }
}

function atrMaeGrid(events) {
  const out = {}
  for (const atr of ["HIGH", "LOW"]) {
    out[atr] = {}
    for (const depth of ["SHALLOW", "DEEP"]) {
      out[atr][depth] = cellStats(events.filter((event) => event.atrBand === atr && event.risk.depth === depth))
    }
  }
  return out
}

function bucketLinks(events) {
  return MAE_BUCKETS.map(([id, label, test]) => {
    const rows = events.filter((event) => finite(event.risk.mae) && test(event.risk.mae))
    const windowLink = spearman(rows.map((event) => ({ x: event.predictors.atrPct, y: event.risk.window })))
    const reboundLink = spearman(rows.map((event) => ({ x: event.predictors.atrPct, y: event.risk.lowToWindow })))
    return {
      id,
      label,
      n: rows.length,
      conclusion: conclusion(rows.length),
      window: { n: windowLink.n, spearman: windowLink.rho },
      lowToWindow: { n: reboundLink.n, spearman: reboundLink.rho },
    }
  })
}

function recoveryGrid(events) {
  const out = {}
  for (const band of ["LOW", "MID", "HIGH"]) {
    out[band] = {}
    for (const [id, , test] of MAE_BUCKETS) {
      const rows = events.filter((event) => event.atrBand === band && event.hold.lowDay != null && finite(event.risk.mae) && test(event.risk.mae))
      out[band][id] = { eligible: rows.length, conclusion: conclusion(rows.length) }
      for (const target of RECOVERY) {
        const days = rows.map((event) => event.hold.hits[target].days).filter(finite)
        out[band][id][target] = {
          reached: days.length,
          hitRate: rows.length ? round2((days.length / rows.length) * 100) : null,
          medianDays: days.length ? round2(median(days)) : null,
        }
      }
    }
  }
  return out
}

function leadershipGrid(events) {
  const out = {}
  for (const leadership of ["HIGH", "LOW"]) {
    out[leadership] = {}
    for (const atr of ["HIGH", "LOW"]) {
      const rows = events.filter((event) => event.leadershipGroup === leadership && event.atrBand === atr)
      const lows = rows.filter((event) => event.hold.lowDay != null)
      const reached = lows.filter((event) => event.hold.hits["10"].reached).length
      out[leadership][atr] = {
        n: rows.length,
        conclusion: conclusion(rows.length),
        window: level(read(rows, (event) => event.risk.window)).mean,
        mae: level(read(rows, (event) => event.risk.mae)).mean,
        mfe: level(read(rows, (event) => event.risk.mfe)).mean,
        ratioMean: shape(read(rows, (event) => event.risk.ratio), [], "ratio").mean,
        ratioMedian: shape(read(rows, (event) => event.risk.ratio), [], "ratio").median,
        lowToWindow: level(read(rows, (event) => event.risk.lowToWindow)).mean,
        hit10: lows.length ? round2((reached / lows.length) * 100) : null,
      }
    }
  }
  return out
}

function solve(matrix, vector) {
  const n = vector.length
  const rows = matrix.map((row, index) => [...row, vector[index]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let row = col + 1; row < n; row++) if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) pivot = row
    const swap = rows[col]
    rows[col] = rows[pivot]
    rows[pivot] = swap
    const scale = rows[col][col]
    if (Math.abs(scale) < 1e-12) return null
    for (let col2 = col; col2 <= n; col2++) rows[col][col2] /= scale
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = rows[row][col]
      for (let col2 = col; col2 <= n; col2++) rows[row][col2] -= factor * rows[col][col2]
    }
  }
  return rows.map((row) => row[n])
}

export function standardizedRegression(rows) {
  const ready = rows.filter((row) => finite(row.y) && finite(row.t0) && finite(row.atr))
  if (ready.length < 5) return null
  const zcol = (key) => {
    const values = ready.map((row) => row[key])
    const scale = sampleStdev(values)
    const center = mean(values)
    return scale ? values.map((value) => (value - center) / scale) : values.map(() => 0)
  }
  const y = zcol("y")
  const t0 = zcol("t0")
  const atr = zcol("atr")
  const xtx = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
  const xty = [0, 0, 0]
  for (let i = 0; i < ready.length; i++) {
    const x = [1, t0[i], atr[i]]
    for (let a = 0; a < 3; a++) {
      xty[a] += x[a] * y[i]
      for (let b = 0; b < 3; b++) xtx[a][b] += x[a] * x[b]
    }
  }
  const beta = solve(xtx, xty)
  if (!beta) return null
  const center = mean(y)
  let sse = 0
  let sst = 0
  for (let i = 0; i < ready.length; i++) {
    const fit = beta[0] + beta[1] * t0[i] + beta[2] * atr[i]
    sse += (y[i] - fit) ** 2
    sst += (y[i] - center) ** 2
  }
  const atrOnly = spearman(ready.map((row) => ({ x: row.atr, y: row.y }))).rho
  return {
    n: ready.length,
    r2: round4(sst === 0 ? null : 1 - sse / sst),
    t0: round4(beta[1]),
    atr: round4(beta[2]),
    atrOnlySpearman: atrOnly,
    sameSign: finite(beta[2]) && finite(atrOnly) && beta[2] !== 0 && atrOnly !== 0 && Math.sign(beta[2]) === Math.sign(atrOnly),
  }
}

function continuous(events) {
  const links = [
    ["window", (event) => event.risk.window],
    ["mae", (event) => event.risk.mae],
    ["mfe", (event) => event.risk.mfe],
    ["lowDepth", (event) => event.risk.lowDepth],
    ["lowWindow", (event) => event.risk.lowToWindow],
    ["hit10", (event) => (event.hold.hits["10"].reached ? event.hold.hits["10"].days : null)],
  ]
  return Object.fromEntries(links.map(([key, readY]) => {
    const link = spearman(events.map((event) => ({ x: event.predictors.atrPct, y: readY(event) })))
    return [key, { n: link.n, spearman: link.rho }]
  }))
}

function valuesOf(events, band, readY) {
  return events.filter((event) => event.atrBand === band).map(readY).filter(finite)
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

export function bootstrapDiff(high, low, trials, seed, scale) {
  if (high.length < 2 || low.length < 2) return null
  const show = scale === "ratio" ? round2 : pct
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
    meanDiff: show(actual),
    medianDiff: show(median(high) - median(low)),
    ci95: [show(boots[Math.floor(0.025 * trials)]), show(boots[Math.ceil(0.975 * trials) - 1])],
    permutationTail: round4(extreme / trials),
  }
}

function tickerGaps(events, readY) {
  const gapOf = (rows) => {
    const high = valuesOf(rows, "HIGH", readY)
    const low = valuesOf(rows, "LOW", readY)
    return high.length && low.length ? mean(high) - mean(low) : null
  }
  const baseline = gapOf(events)
  const gaps = [...new Set(events.map((event) => event.ticker))]
    .map((ticker) => gapOf(events.filter((event) => event.ticker !== ticker)))
    .filter(finite)
  return {
    baseline: pct(baseline),
    min: pct(Math.min(...gaps)),
    max: pct(Math.max(...gaps)),
    median: pct(median(gaps)),
    signFlips: gaps.filter((value) => Math.sign(value) !== Math.sign(baseline) && value !== 0).length,
  }
}

function tickerRobust(events) {
  const specs = [
    ["window", (event) => event.risk.window],
    ["mae", (event) => event.risk.mae],
    ["lowWindow", (event) => event.risk.lowToWindow],
  ]
  const out = { withinStock: "결론 금지" }
  for (const [key, readY] of specs) {
    const usable = events.filter((event) => finite(readY(event)) && finite(event.predictors.atrPct))
    const eventLink = spearman(usable.map((event) => ({ x: event.predictors.atrPct, y: readY(event) })))
    const groups = new Map()
    for (const event of usable) {
      const group = groups.get(event.ticker) ?? { x: [], y: [] }
      group.x.push(event.predictors.atrPct)
      group.y.push(readY(event))
      groups.set(event.ticker, group)
    }
    const tickerLink = spearman([...groups].map(([, group]) => ({ x: mean(group.x), y: mean(group.y) })))
    const leave = leaveOneCorrelation(usable, (event) => event.predictors.atrPct, readY)
    out[key] = {
      eventWeighted: { n: eventLink.n, spearman: eventLink.rho },
      tickerWeighted: { tickers: groups.size, spearman: tickerLink.rho, maxEvents: Math.max(...[...groups].map(([, group]) => group.y.length)) },
      leaveOneTicker: { baseline: leave.baseline.rho, min: leave.min, max: leave.max, median: leave.median, signFlips: leave.signFlips },
      highLowGap: tickerGaps(events, readY),
    }
  }
  return out
}

export function judgeRisk(input) {
  const windowUp = finite(input.windowGap) && input.windowGap > 0
  const reboundUp = finite(input.lowWindowGap) && input.lowWindowGap > 0
  const ratioUp = finite(input.ratioMeanGap) && input.ratioMeanGap > 0 && finite(input.ratioMedianGap) && input.ratioMedianGap > 0
  const excessive = (finite(input.worse15Gap) && input.worse15Gap >= 15)
    || (finite(input.worse20Gap) && input.worse20Gap >= 10)
    || (finite(input.maeMedianGap) && input.maeMedianGap <= -5)
  const bootStable = finite(input.windowCiLow) && input.windowCiLow > 0
    && finite(input.lowWindowCiLow) && input.lowWindowCiLow > 0
    && finite(input.ratioCiLow) && input.ratioCiLow > 0
  const loo = finite(input.looWindowMin) && input.looWindowMin > 0 && finite(input.looLowMin) && input.looLowMin > 0
  if (windowUp && reboundUp && ratioUp && !excessive && bootStable && loo) return { label: "강하게 지지" }
  const ratioGone = (!finite(input.ratioMeanGap) || input.ratioMeanGap <= 0) && (!finite(input.ratioMedianGap) || input.ratioMedianGap <= 0)
  const looBroke = finite(input.looWindowMin) && input.looWindowMin <= 0
  if (!windowUp || !reboundUp || ratioGone || looBroke) return { label: "확인 실패" }
  return { label: "부분적으로 지지" }
}

export function study(events, options = {}) {
  if (V20_SELECTED_STRATEGY !== null || SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  assertBaseline(events)
  if (events.bandCounts.LOW !== 34 || events.bandCounts.MID !== 34 || events.bandCounts.HIGH !== 35) {
    throw new Error("ATR groups changed")
  }
  if (!events[0]?.risk) throw new Error("risk path is missing")
  const trials = options.bootstrap ?? BOOTSTRAP
  const bands = {}
  for (const band of ["LOW", "MID", "HIGH"]) bands[band] = bandBlock(events.filter((event) => event.atrBand === band))
  const highLow = {
    windowMean: gap(bands.HIGH.window.mean, bands.LOW.window.mean),
    windowMedian: gap(bands.HIGH.window.median, bands.LOW.window.median),
    maeMean: gap(bands.HIGH.mae.mean, bands.LOW.mae.mean),
    maeMedian: gap(bands.HIGH.mae.median, bands.LOW.mae.median),
    mfeMean: gap(bands.HIGH.mfe.mean, bands.LOW.mfe.mean),
    mfeMedian: gap(bands.HIGH.mfe.median, bands.LOW.mfe.median),
    ratioMean: gap(bands.HIGH.ratio.mean, bands.LOW.ratio.mean),
    ratioMedian: gap(bands.HIGH.ratio.median, bands.LOW.ratio.median),
    lowDepthMean: gap(bands.HIGH.lowDepth.mean, bands.LOW.lowDepth.mean),
    lowDepthMedian: gap(bands.HIGH.lowDepth.median, bands.LOW.lowDepth.median),
    lowWindowMean: gap(bands.HIGH.lowToWindow.mean, bands.LOW.lowToWindow.mean),
    lowWindowMedian: gap(bands.HIGH.lowToWindow.median, bands.LOW.lowToWindow.median),
    worse15: gap(bands.HIGH.mae.n ? share(events.filter((event) => event.atrBand === "HIGH" && finite(event.risk.mae)).map((event) => event.risk.mae <= -0.15)) : null,
      share(events.filter((event) => event.atrBand === "LOW" && finite(event.risk.mae)).map((event) => event.risk.mae <= -0.15))),
    worse20: gap(share(events.filter((event) => event.atrBand === "HIGH" && finite(event.risk.mae)).map((event) => event.risk.mae <= -0.2)),
      share(events.filter((event) => event.atrBand === "LOW" && finite(event.risk.mae)).map((event) => event.risk.mae <= -0.2))),
  }
  const links = continuous(events)
  const robust = tickerRobust(events)
  const reads = {
    window: [(event) => event.risk.window, "percent"],
    mae: [(event) => event.risk.mae, "percent"],
    mfe: [(event) => event.risk.mfe, "percent"],
    lowDepth: [(event) => event.risk.lowDepth, "percent"],
    lowWindow: [(event) => event.risk.lowToWindow, "percent"],
    ratio: [(event) => event.risk.ratio, "ratio"],
  }
  const boot = {}
  let seed = 20261021
  for (const [key, [readY, scale]] of Object.entries(reads)) {
    boot[key] = bootstrapDiff(valuesOf(events, "HIGH", readY), valuesOf(events, "LOW", readY), trials, seed, scale)
    seed += 17
  }
  const regressionRows = events.map((event) => ({ y: event.risk.window, t0: event.t0, atr: event.predictors.atrPct, mae: event.risk.mae }))
  const judgment = judgeRisk({
    windowGap: highLow.windowMean,
    lowWindowGap: highLow.lowWindowMean,
    ratioMeanGap: highLow.ratioMean,
    ratioMedianGap: highLow.ratioMedian,
    worse15Gap: highLow.worse15,
    worse20Gap: highLow.worse20,
    maeMedianGap: highLow.maeMedian,
    windowCiLow: boot.window?.ci95?.[0],
    lowWindowCiLow: boot.lowWindow?.ci95?.[0],
    ratioCiLow: boot.ratio?.ci95?.[0],
    looWindowMin: robust.window.highLowGap.min,
    looLowMin: robust.lowWindow.highLowGap.min,
  })
  return {
    selectedStrategy: SELECTED_STRATEGY,
    bands,
    highLow,
    buckets: drawdownBuckets(events),
    atrMae: atrMaeGrid(events),
    bucketLinks: bucketLinks(events),
    recovery: recoveryGrid(events),
    leadership: leadershipGrid(events),
    regression: {
      window: standardizedRegression(regressionRows.map((row) => ({ y: row.y, t0: row.t0, atr: row.atr }))),
      mae: standardizedRegression(regressionRows.filter((row) => finite(row.mae)).map((row) => ({ y: row.mae, t0: row.t0, atr: row.atr }))),
      note: "Standardized association. Not a causal estimate.",
    },
    continuous: links,
    robust,
    bootstrap: boot,
    v20Link: {
      windowSpearman: links.window.spearman,
      lowWindowSpearman: links.lowWindow.spearman,
      maeSpearman: links.mae.spearman,
      sameReboundSign: finite(links.window.spearman) && finite(links.lowWindow.spearman) && Math.sign(links.window.spearman) === Math.sign(links.lowWindow.spearman) && links.window.spearman !== 0,
    },
    judgment,
  }
}
