/**
 * US single-stock ATR robustness study v13 (research only).
 *
 * Checks whether the correction-day ATR association with the post-low rebound
 * stays in place when the cut, clock, sample, or weight changes. No sell rule
 * is selected.
 */

import { mean, median, spearman } from "./equity-sell-backtest-v2.mjs"
import { fitInferred } from "./equity-sell-backtest-v9.mjs"
import { standardizedFit } from "./equity-sell-backtest-v12.mjs"
import { attachProfile, loadOhlcv, selectMildEvents } from "./equity-sell-backtest-v12.mjs"

export { loadOhlcv, selectMildEvents, attachProfile }

export const SELECTED_STRATEGY = null
export const BOOTSTRAP_REPS = 10000
export const PERMUTATION_REPS = 10000
export const BOOTSTRAP_SEED = 20261006
export const BASELINE = {
  events: 103,
  lowEvents: 102,
  bands: { LOW: 34, MID: 34, HIGH: 35 },
  lowWindow: 0.4107,
  entryWindow: 0.1863,
  lowT5: 0.2688,
  lowT10: 0.3494,
  lowT20: 0.4541,
  hit10: -0.3421,
}
const MAGNITUDE_FLOOR = 0.2

function finite(value) {
  return Number.isFinite(value)
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

export function mulberry32(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function link(events, yRead) {
  return spearman(events.map((event) => ({ x: event.predictors.atrPct, y: yRead(event) })).filter((pair) => finite(pair.x) && finite(pair.y)))
}

export function baselineLinks(events) {
  return {
    lowT5: link(events, (event) => event.fromLow.t5),
    lowT10: link(events, (event) => event.fromLow.t10),
    lowT20: link(events, (event) => event.fromLow.t20),
    lowWindow: link(events, (event) => event.lowToWindow),
    entryT5: link(events, (event) => event.entryPath.t5),
    entryT10: link(events, (event) => event.entryPath.t10),
    entryT20: link(events, (event) => event.entryPath.t20),
    entryT40: link(events, (event) => event.entryPath.t40),
    entryWindow: link(events, (event) => event.entryPath.window),
    hit3: link(events, (event) => (event.lowDay == null ? null : event.hits["3"].reached ? 1 : 0)),
    hit5: link(events, (event) => (event.lowDay == null ? null : event.hits["5"].reached ? 1 : 0)),
    hit10: link(events, (event) => (event.lowDay == null ? null : event.hits["10"].reached ? 1 : 0)),
    hit15: link(events, (event) => (event.lowDay == null ? null : event.hits["15"].reached ? 1 : 0)),
    hit20: link(events, (event) => (event.lowDay == null ? null : event.hits["20"].reached ? 1 : 0)),
    hitTime3: link(events, (event) => event.hits["3"].days),
    hitTime5: link(events, (event) => event.hits["5"].days),
    hitTime10: link(events, (event) => event.hits["10"].days),
    hitTime15: link(events, (event) => event.hits["15"].days),
    hitTime20: link(events, (event) => event.hits["20"].days),
  }
}

export function assertBaseline(events, links) {
  const bands = events.bandCounts
  const lowEvents = events.filter((event) => event.lowDay != null).length
  const checks = [
    [events.length, BASELINE.events, "events"],
    [lowEvents, BASELINE.lowEvents, "low events"],
    [bands.LOW, BASELINE.bands.LOW, "ATR LOW"],
    [bands.MID, BASELINE.bands.MID, "ATR MID"],
    [bands.HIGH, BASELINE.bands.HIGH, "ATR HIGH"],
    [links.lowWindow.rho, BASELINE.lowWindow, "low window"],
    [links.entryWindow.rho, BASELINE.entryWindow, "entry window"],
    [links.lowT5.rho, BASELINE.lowT5, "low T+5"],
    [links.lowT10.rho, BASELINE.lowT10, "low T+10"],
    [links.lowT20.rho, BASELINE.lowT20, "low T+20"],
    [links.hitTime10.rho, BASELINE.hit10, "+10% timing"],
  ]
  const failed = checks.filter((row) => row[0] !== row[1]).map((row) => `${row[2]} ${row[0]} !== ${row[1]}`)
  if (failed.length) throw new Error(`baseline changed:\n${failed.join("\n")}`)
}

export function tailBands(events, fraction) {
  const count = Math.floor(events.length * fraction)
  const ordered = [...events].sort((a, b) => a.predictors.atrPct - b.predictors.atrPct || a.eventId.localeCompare(b.eventId))
  const low = new Set(ordered.slice(0, count).map((event) => event.eventId))
  const high = new Set(ordered.slice(ordered.length - count).map((event) => event.eventId))
  return events.map((event) => ({ ...event, tail: low.has(event.eventId) ? "LOW" : high.has(event.eventId) ? "HIGH" : "MID" }))
}

function level(rows, read) {
  const values = rows.map(read).filter(finite)
  return {
    n: values.length,
    avg: finite(mean(values)) ? Math.round(mean(values) * 10000) / 100 : null,
    median: finite(median(values)) ? Math.round(median(values) * 10000) / 100 : null,
  }
}

function hitLevel(rows) {
  const eligible = rows.filter((event) => event.lowDay != null)
  const days = eligible.map((event) => event.hits["10"].days).filter(finite)
  return {
    eligible: eligible.length,
    reached: days.length,
    rate: eligible.length ? Math.round((days.length / eligible.length) * 10000) / 100 : null,
    medianDays: finite(median(days)) ? Math.round(median(days) * 100) / 100 : null,
  }
}

export function tailContrast(events, fraction) {
  const tagged = tailBands(events, fraction)
  const side = (name) => tagged.filter((event) => event.tail === name)
  const low = side("LOW")
  const high = side("HIGH")
  const kept = tagged.filter((event) => event.tail !== "MID")
  const pack = (rows) => ({
    n: rows.length,
    lowWindow: level(rows, (event) => event.lowToWindow),
    entryWindow: level(rows, (event) => event.entryPath.window),
    lowT20: level(rows, (event) => event.fromLow.t20),
    hit10: hitLevel(rows),
  })
  const left = pack(high)
  const right = pack(low)
  const gap = (a, b) => (finite(a) && finite(b) ? Math.round((a - b) * 100) / 100 : null)
  return {
    fraction,
    lowN: low.length,
    highN: high.length,
    low: right,
    high: left,
    highMinusLow: {
      lowWindow: gap(left.lowWindow.avg, right.lowWindow.avg),
      entryWindow: gap(left.entryWindow.avg, right.entryWindow.avg),
      lowT20: gap(left.lowT20.avg, right.lowT20.avg),
      hit10Rate: gap(left.hit10.rate, right.hit10.rate),
      hit10MedianDays: gap(left.hit10.medianDays, right.hit10.medianDays),
    },
    rho: {
      lowWindow: link(kept, (event) => event.lowToWindow),
      lowT20: link(kept, (event) => event.fromLow.t20),
      hit10: link(kept, (event) => event.hits["10"].days),
    },
  }
}

export function logCheck(events) {
  const raw = events.map((event) => event.predictors.atrPct)
  const logged = raw.map((value) => Math.log(value))
  const order = (values) => [...values.keys()].sort((a, b) => values[a] - values[b] || a - b).join(",")
  const pairs = events
    .filter((event) => finite(event.lowToWindow) && event.predictors.atrPct > 0)
    .map((event) => ({ y: event.lowToWindow * 100, atr: event.predictors.atrPct * 100, logAtr: Math.log(event.predictors.atrPct) }))
  return {
    sameRank: order(raw) === order(logged),
    spearman: spearman(events.map((event) => ({ x: event.predictors.atrPct, y: Math.log(event.predictors.atrPct) })).filter((pair) => finite(pair.x) && finite(pair.y))),
    raw: fitInferred(pairs, ["atr"]),
    log: fitInferred(pairs, ["logAtr"]),
  }
}

export function periodOf(date) {
  if (date >= "2016-01-01" && date <= "2020-12-31") return "A"
  if (date >= "2021-01-01" && date <= "2023-12-31") return "B"
  if (date >= "2024-01-01") return "C"
  return "outside"
}

function coreRho(events) {
  return {
    lowWindow: link(events, (event) => event.lowToWindow),
    lowT20: link(events, (event) => event.fromLow.t20),
    hit10: link(events, (event) => event.hits["10"].days),
  }
}

export function periodLinks(events) {
  const buckets = { A: [], B: [], C: [], outside: [] }
  for (const event of events) buckets[periodOf(event.t0Date)].push(event)
  return Object.fromEntries(["A", "B", "C", "outside"].map((key) => [key, { n: buckets[key].length, ...coreRho(buckets[key]) }]))
}

export function stockLinks(events) {
  const outcomes = [
    ["lowT10", (event) => event.fromLow.t10],
    ["lowT20", (event) => event.fromLow.t20],
    ["lowWindow", (event) => event.lowToWindow],
    ["entryWindow", (event) => event.entryPath.window],
    ["hit10", (event) => event.hits["10"].days],
  ]
  const out = {}
  for (const [key, read] of outcomes) {
    const groups = new Map()
    for (const event of events) {
      const y = read(event)
      if (!finite(event.predictors.atrPct) || !finite(y)) continue
      if (!groups.has(event.ticker)) groups.set(event.ticker, { x: [], y: [] })
      groups.get(event.ticker).x.push(event.predictors.atrPct)
      groups.get(event.ticker).y.push(y)
    }
    const pairs = [...groups.values()].map((group) => ({ x: mean(group.x), y: mean(group.y) }))
    out[key] = { ...spearman(pairs), tickers: pairs.length }
  }
  return out
}

function byTicker(events) {
  const groups = new Map()
  for (const event of events) {
    if (!groups.has(event.ticker)) groups.set(event.ticker, [])
    groups.get(event.ticker).push(event)
  }
  for (const rows of groups.values()) rows.sort((a, b) => a.t0Date.localeCompare(b.t0Date) || a.eventId.localeCompare(b.eventId))
  return groups
}

export function edgeEvents(events) {
  const groups = byTicker(events)
  const first = [...groups.values()].map((rows) => rows[0])
  const last = [...groups.values()].map((rows) => rows[rows.length - 1])
  return {
    first: { n: first.length, ...coreRho(first) },
    last: { n: last.length, ...coreRho(last) },
  }
}

export function extremeLinks(events) {
  const ordered = [...events].sort((a, b) => b.predictors.atrPct - a.predictors.atrPct || a.eventId.localeCompare(b.eventId))
  const ascending = [...ordered].reverse()
  const drop = (rows, count) => {
    const gone = new Set(rows.slice(0, count).map((event) => event.eventId))
    return events.filter((event) => !gone.has(event.eventId))
  }
  const result = { all: { n: events.length, ...coreRho(events) } }
  for (const count of [1, 3, 5]) {
    result[`dropHigh${count}`] = { n: events.length - count, ...coreRho(drop(ordered, count)) }
    result[`dropLow${count}`] = { n: events.length - count, ...coreRho(drop(ascending, count)) }
  }
  return result
}

function quantile(sorted, p) {
  if (!sorted.length) return null
  const index = (sorted.length - 1) * p
  const lo = Math.floor(index)
  const hi = Math.ceil(index)
  if (lo === hi) return sorted[lo]
  return sorted[lo] * (hi - index) + sorted[hi] * (index - lo)
}

export function bootstrapSpearman(pairs, reps, rng) {
  const rhos = []
  for (let rep = 0; rep < reps; rep += 1) {
    const draw = []
    for (let index = 0; index < pairs.length; index += 1) draw.push(pairs[Math.floor(rng() * pairs.length)])
    const rho = spearman(draw).rho
    if (finite(rho)) rhos.push(rho)
  }
  rhos.sort((a, b) => a - b)
  return {
    reps: rhos.length,
    p2_5: quantile(rhos, 0.025),
    p50: quantile(rhos, 0.5),
    p97_5: quantile(rhos, 0.975),
  }
}

export function clusterBootstrap(groups, reps, rng) {
  const tickers = [...groups.keys()]
  const rhos = []
  for (let rep = 0; rep < reps; rep += 1) {
    const draw = []
    for (let index = 0; index < tickers.length; index += 1) draw.push(...groups.get(tickers[Math.floor(rng() * tickers.length)]))
    const rho = spearman(draw).rho
    if (finite(rho)) rhos.push(rho)
  }
  rhos.sort((a, b) => a - b)
  return { tickers: tickers.length, reps: rhos.length, p2_5: quantile(rhos, 0.025), p50: quantile(rhos, 0.5), p97_5: quantile(rhos, 0.975) }
}

export function permutationRank(pairs, reps, rng) {
  const observed = spearman(pairs).rho
  const ys = pairs.map((pair) => pair.y)
  let atOrAbove = 0
  for (let rep = 0; rep < reps; rep += 1) {
    for (let index = ys.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(rng() * (index + 1))
      const hold = ys[index]
      ys[index] = ys[swap]
      ys[swap] = hold
    }
    const rho = spearman(pairs.map((pair, index) => ({ x: pair.x, y: ys[index] }))).rho
    if (finite(rho) && rho >= observed) atOrAbove += 1
  }
  return { observed, reps, shareAtLeastObserved: atOrAbove / reps, percentile: Math.round((1 - atOrAbove / reps) * 10000) / 100 }
}

function design(event, yRead) {
  const y = yRead(event)
  const scale = (value) => (finite(value) ? value * 100 : null)
  return {
    y: scale(y),
    t0: scale(event.predictors.t0),
    leadership: event.predictors.leadership,
    atrPct: scale(event.predictors.atrPct),
    vol20: scale(event.predictors.vol20),
    correctionSpeed: scale(event.predictors.correctionSpeed),
  }
}

function model(events, yRead, keys) {
  const rows = events.map((event) => design(event, yRead)).filter((row) => finite(row.y) && keys.every((key) => finite(row[key])))
  const fit = standardizedFit(rows, keys)
  const coef = Object.fromEntries((fit.coefficients ?? []).map((row) => [row.name, row.coefficient]))
  return { n: fit.n, r2: fit.r2, adjustedR2: fit.adjustedR2, standardizedBeta: coef }
}

export function volatilityModels(events) {
  const y = (event) => event.lowToWindow
  const fit = (keys) => model(events, y, keys)
  const both = events.map((event) => design(event, y)).filter((row) => ["t0", "leadership", "atrPct", "vol20"].every((key) => finite(row[key])) && finite(row.y))
  const vif = ["t0", "leadership", "atrPct", "vol20"].map((key) => {
    const others = ["t0", "leadership", "atrPct", "vol20"].filter((item) => item !== key)
    const rows = both.map((row) => ({ ...row, y: row[key] }))
    const r2 = fitInferred(rows, others).r2
    return { key, r2, vif: finite(r2) && r2 < 1 ? Math.round((1 / (1 - r2)) * 100) / 100 : null }
  })
  return {
    atr: fit(["t0", "leadership", "atrPct"]),
    vol: fit(["t0", "leadership", "vol20"]),
    both: fit(["t0", "leadership", "atrPct", "vol20"]),
    vif,
  }
}

export function speedModels(events) {
  const outcomes = [
    ["t20", (event) => event.entryPath.t20],
    ["window", (event) => event.entryPath.window],
    ["lowWindow", (event) => event.lowToWindow],
  ]
  const out = {}
  for (const [key, read] of outcomes) {
    out[key] = {
      atr: model(events, read, ["t0", "leadership", "atrPct"]),
      withSpeed: model(events, read, ["t0", "leadership", "atrPct", "correctionSpeed"]),
    }
  }
  return out
}

export function intradayStudy(events, seriesBySymbol) {
  let comparable = 0
  let distinct = 0
  for (const series of seriesBySymbol.values()) {
    for (let index = 0; index < series.closes.length; index += 1) {
      if (!finite(series.lows[index]) || !(series.closes[index] > 0)) continue
      comparable += 1
      if (series.lows[index] < series.closes[index]) distinct += 1
    }
  }
  if (!comparable || distinct / comparable < 0.5) return { status: "data unavailable", distinctShare: comparable ? distinct / comparable : null }
  const rows = []
  for (const event of events) {
    const series = seriesBySymbol.get(event.ticker)
    const entryIdx = dateIndex(series.dates, event.episodeStart)
    const t0Idx = dateIndex(series.dates, event.t0Date)
    const endIdx = entryIdx + 60
    let minLow = null
    let usable = true
    for (let index = t0Idx + 1; index <= endIdx; index += 1) {
      if (!finite(series.lows[index])) {
        usable = false
        break
      }
      if (minLow == null || series.lows[index] < minLow) minLow = series.lows[index]
    }
    if (!usable || !(minLow > 0)) continue
    const entry = series.closes[entryIdx]
    rows.push({
      atrPct: event.predictors.atrPct,
      depth: -(minLow / entry - 1),
      rebound: series.closes[endIdx] / minLow - 1,
    })
  }
  const closeDepth = spearman(events.map((event) => ({ x: event.predictors.atrPct, y: event.drawdown })).filter((pair) => finite(pair.x) && finite(pair.y)))
  const closeRebound = link(events, (event) => event.lowToWindow)
  return {
    status: "available",
    distinctShare: Math.round((distinct / comparable) * 10000) / 10000,
    n: rows.length,
    close: { depth: closeDepth, rebound: closeRebound },
    intraday: {
      depth: spearman(rows.map((row) => ({ x: row.atrPct, y: row.depth }))),
      rebound: spearman(rows.map((row) => ({ x: row.atrPct, y: row.rebound }))),
    },
  }
}

function cell(stat) {
  return { rho: stat?.rho ?? null, n: stat?.n ?? 0 }
}

function signHeld(lowWindow, lowT20, hit10) {
  const checks = [
    [lowWindow, 1],
    [lowT20, 1],
    [hit10, -1],
  ]
  const usable = checks.filter((row) => row[0].n >= 10 && finite(row[0].rho))
  if (!usable.length) return "표본 부족"
  return usable.every((row) => Math.sign(row[0].rho) === row[1]) ? "유지" : "변화"
}

export function robustnessMatrix(parts) {
  const row = (id, lowWindow, lowT20, hit10) => ({
    id,
    lowWindow: cell(lowWindow),
    lowT20: cell(lowT20),
    hit10: cell(hit10),
    sign: signHeld(cell(lowWindow), cell(lowT20), cell(hit10)),
  })
  return [
    row("continuous", parts.links.lowWindow, parts.links.lowT20, parts.links.hitTime10),
    row("tail25", parts.tails[0.25].rho.lowWindow, parts.tails[0.25].rho.lowT20, parts.tails[0.25].rho.hit10),
    row("tail20", parts.tails[0.2].rho.lowWindow, parts.tails[0.2].rho.lowT20, parts.tails[0.2].rho.hit10),
    row("tail30", parts.tails[0.3].rho.lowWindow, parts.tails[0.3].rho.lowT20, parts.tails[0.3].rho.hit10),
    row("log", parts.links.lowWindow, parts.links.lowT20, parts.links.hitTime10),
    row("first", parts.edges.first.lowWindow, parts.edges.first.lowT20, parts.edges.first.hit10),
    row("last", parts.edges.last.lowWindow, parts.edges.last.lowT20, parts.edges.last.hit10),
    row("dropHigh1", parts.extremes.dropHigh1.lowWindow, parts.extremes.dropHigh1.lowT20, parts.extremes.dropHigh1.hit10),
    row("dropHigh3", parts.extremes.dropHigh3.lowWindow, parts.extremes.dropHigh3.lowT20, parts.extremes.dropHigh3.hit10),
    row("dropHigh5", parts.extremes.dropHigh5.lowWindow, parts.extremes.dropHigh5.lowT20, parts.extremes.dropHigh5.hit10),
    row("periodA", parts.periods.A.lowWindow, parts.periods.A.lowT20, parts.periods.A.hit10),
    row("periodB", parts.periods.B.lowWindow, parts.periods.B.lowT20, parts.periods.B.hit10),
    row("periodC", parts.periods.C.lowWindow, parts.periods.C.lowT20, parts.periods.C.hit10),
    row("stock", parts.stock.lowWindow, parts.stock.lowT20, parts.stock.hit10),
  ]
}

export function judgeRobustness(rows) {
  const sensitivity = rows.filter((row) => row.id !== "continuous" && row.id !== "log")
  const enough = sensitivity.filter((row) => row.lowWindow.n >= 10 && finite(row.lowWindow.rho))
  if (enough.length < sensitivity.length / 2) return { detail: "판정 불가", label: "표본 부족" }
  if (enough.some((row) => row.lowWindow.rho <= 0)) return { detail: "약한 견고성", label: "불안정" }
  const collapsed = enough.some((row) => row.lowWindow.rho < MAGNITUDE_FLOOR)
  const timingFlip = sensitivity.some((row) => row.hit10.n >= 10 && finite(row.hit10.rho) && row.hit10.rho >= 0)
  if (collapsed || timingFlip) return { detail: "중간 견고성", label: "부분적으로 견고" }
  return { detail: "강한 견고성", label: "견고" }
}

export function lowWindowPairs(events) {
  return events
    .filter((event) => finite(event.predictors.atrPct) && finite(event.lowToWindow))
    .map((event) => ({ x: event.predictors.atrPct, y: event.lowToWindow }))
}

export function lowWindowGroups(events) {
  const groups = new Map()
  for (const event of events) {
    if (!finite(event.lowToWindow)) continue
    if (!groups.has(event.ticker)) groups.set(event.ticker, [])
    groups.get(event.ticker).push({ x: event.predictors.atrPct, y: event.lowToWindow })
  }
  return groups
}
