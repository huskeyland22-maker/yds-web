/**
 * US single-stock entry-state study v7 (research only).
 *
 * Predictors use only data knowable at the -10% correction close.
 * Post-entry volume is descriptive and is not a predictor.
 * No sell rule is selected.
 */

import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./equity-sell-research-universe.mjs"
import { mean, median, sampleJudgment, spearman } from "./equity-sell-backtest-v2.mjs"
import { PROFIT_ARM } from "./equity-sell-backtest-v1.mjs"
import { FORWARD_DAYS, locateProfitCorrection } from "./etf-sell-backtest-v6.mjs"
import { describeRebound } from "./equity-sell-backtest-v6.mjs"

export { EQUITY_SELL_RESEARCH_UNIVERSE }

export const SELECTED_STRATEGY = null
export const LOCKED_MILD_EVENTS = 103
export const LOCKED_MILD_GROUPS = { HIGH: 15, MID: 53, LOW: 35 }
export const CORRECTION_DEPTH = 0.1
export const MODEL_VOLUME = "volumeRatio20"
export const MODEL_VOLATILITY = "atrPct"
export const MODEL_SPEED = "correctionSpeed"

export const PREDICTORS = [
  { id: "entryVolume", group: "A", asOf: "correction close", label: "A1 entry-day volume" },
  { id: "avgVolume5", group: "A", asOf: "5 sessions before the correction close", label: "A2 prior 5-day average volume" },
  { id: "avgVolume20", group: "A", asOf: "20 sessions before the correction close", label: "A3 prior 20-day average volume" },
  { id: "volumeRatio5", group: "A", asOf: "correction close versus the prior 5 sessions", label: "A4 entry volume / prior 5-day average" },
  { id: "volumeRatio20", group: "A", asOf: "correction close versus the prior 20 sessions", label: "A5 entry volume / prior 20-day average" },
  { id: "volumeTrend5v20", group: "A", asOf: "20 sessions before the correction close", label: "A6 prior 5-day average / prior 20-day average" },
  { id: "atr14", group: "B", asOf: "14 true ranges ending at the correction close", label: "B1 ATR(14)" },
  { id: "atrPct", group: "B", asOf: "14 true ranges ending at the correction close", label: "B2 ATR(14) / entry close" },
  { id: "vol20", group: "B", asOf: "20 daily returns ending at the correction close", label: "B3 20-day realized volatility" },
  { id: "vol5", group: "B", asOf: "5 daily returns ending at the correction close", label: "B4 5-day realized volatility" },
  { id: "volRatio5v20", group: "B", asOf: "20 daily returns ending at the correction close", label: "B5 5-day vol / 20-day vol" },
  { id: "correctionDuration", group: "C", asOf: "sessions from the prior peak through the correction close", label: "C1 peak-to-entry trading days" },
  { id: "correctionSpeed", group: "C", asOf: "peak-to-entry decline divided by those sessions", label: "C2 drawdown per session" },
  { id: "peakToEntry", group: "C", asOf: "prior peak close and the correction close", label: "C3 peak-to-entry return" },
  { id: "maxDrawdownToEntry", group: "C", asOf: "closes from the prior peak through the correction close", label: "C4 max drawdown from that peak through entry" },
  { id: "armToEntry", group: "C", asOf: "the +10% bar through the correction close", label: "C5 return from the +10% bar to entry" },
  { id: "correctionVol", group: "C", asOf: "daily returns after the prior peak through the correction close", label: "C6 volatility of that correction path" },
  { id: "correctionVolumeAccel", group: "C", asOf: "20 sessions before the peak and sessions after the peak through entry", label: "C7 correction average volume / pre-peak 20-day average" },
  { id: "ret5", group: "D", asOf: "last close before the correction bar", label: "D1 5-session return into the prior close" },
  { id: "ret10", group: "D", asOf: "last close before the correction bar", label: "D2 10-session return into the prior close" },
  { id: "ret20", group: "D", asOf: "last close before the correction bar", label: "D3 20-session return into the prior close" },
  { id: "distMa20", group: "D", asOf: "20 closes ending the session before entry", label: "D4 prior close versus its 20-session average" },
  { id: "distMa50", group: "D", asOf: "50 closes ending the session before entry", label: "D5 prior close versus its 50-session average" },
  { id: "pos60", group: "D", asOf: "60 closes ending the session before entry", label: "D6 prior close position in the prior 60-session close range" },
  { id: "pos120", group: "D", asOf: "120 closes ending the session before entry", label: "D7 prior close position in the prior 120-session close range" },
]

const OMITTED = {
  id: "correctionVolumeIntensity",
  reason: "A raw sum of shares from the peak to entry is not comparable across stocks, and no ratio was defined for A7. C7 is the specified volume-change ratio instead.",
}

function round2(value) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 100) / 100
}

function round4(value) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 10000) / 10000
}

function finite(value) {
  return Number.isFinite(value)
}

function windowMean(values) {
  if (!values.length || values.some((value) => !finite(value))) return null
  return mean(values)
}

export function sampleStdev(values) {
  if (values.length < 2 || values.some((value) => !finite(value))) return null
  const center = mean(values)
  const variance = values.reduce((sum, value) => sum + (value - center) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

export function loadOhlcv(bars) {
  const dates = []
  const highs = []
  const lows = []
  const closes = []
  const volumes = []
  for (const bar of bars ?? []) {
    if (!bar?.date || !(bar.close > 0)) continue
    dates.push(bar.date)
    closes.push(bar.close)
    highs.push(finite(bar.high) ? bar.high : null)
    lows.push(finite(bar.low) ? bar.low : null)
    volumes.push(finite(bar.volume) && bar.volume >= 0 ? bar.volume : null)
  }
  return { dates, highs, lows, closes, volumes }
}

export function volumeBlock(volumes, t0) {
  const entryVolume = volumes[t0]
  const avgVolume5 = t0 >= 5 ? windowMean(volumes.slice(t0 - 5, t0)) : null
  const avgVolume20 = t0 >= 20 ? windowMean(volumes.slice(t0 - 20, t0)) : null
  const ratio = (num, den) => (finite(num) && finite(den) && den > 0 ? num / den : null)
  return {
    entryVolume: finite(entryVolume) ? entryVolume : null,
    avgVolume5,
    avgVolume20,
    volumeRatio5: ratio(entryVolume, avgVolume5),
    volumeRatio20: ratio(entryVolume, avgVolume20),
    volumeTrend5v20: ratio(avgVolume5, avgVolume20),
  }
}

function trueRange(highs, lows, closes, index) {
  const high = highs[index]
  const low = lows[index]
  const prev = closes[index - 1]
  if (!finite(high) || !finite(low) || !finite(prev)) return null
  return Math.max(high - low, Math.abs(high - prev), Math.abs(low - prev))
}

export function volatilityBlock(highs, lows, closes, t0) {
  let atr14 = null
  if (t0 >= 14) {
    const ranges = []
    for (let index = t0 - 13; index <= t0; index++) ranges.push(trueRange(highs, lows, closes, index))
    atr14 = windowMean(ranges)
  }
  const realized = (days) => {
    if (t0 < days) return null
    const returns = []
    for (let index = t0 - days + 1; index <= t0; index++) returns.push(closes[index] / closes[index - 1] - 1)
    const deviation = sampleStdev(returns)
    return deviation == null ? null : deviation * Math.sqrt(252)
  }
  const vol5 = realized(5)
  const vol20 = realized(20)
  return {
    atr14,
    atrPct: finite(atr14) && closes[t0] > 0 ? atr14 / closes[t0] : null,
    vol5,
    vol20,
    volRatio5v20: finite(vol5) && finite(vol20) && vol20 > 0 ? vol5 / vol20 : null,
  }
}

export function correctionBlock(closes, volumes, entryIdx, t0Idx) {
  const located = locateProfitCorrection(closes, entryIdx, FORWARD_DAYS, PROFIT_ARM, CORRECTION_DEPTH)
  if (!located.event || located.t0 !== t0Idx) return { matched: false }
  const duration = t0Idx - located.peakIdx
  const peak = located.peak
  const entryClose = closes[t0Idx]
  const decline = peak > 0 ? (peak - entryClose) / peak : null
  let trough = peak
  for (let index = located.peakIdx; index <= t0Idx; index++) trough = Math.min(trough, closes[index])
  const returns = []
  for (let index = located.peakIdx + 1; index <= t0Idx; index++) returns.push(closes[index] / closes[index - 1] - 1)
  const prePeak = located.peakIdx >= 20 ? windowMean(volumes.slice(located.peakIdx - 20, located.peakIdx)) : null
  const during = duration > 0 ? windowMean(volumes.slice(located.peakIdx + 1, t0Idx + 1)) : null
  return {
    matched: true,
    correctionDuration: duration,
    correctionSpeed: finite(decline) && duration > 0 ? decline / duration : null,
    peakToEntry: peak > 0 ? entryClose / peak - 1 : null,
    maxDrawdownToEntry: peak > 0 ? (peak - trough) / peak : null,
    armToEntry: closes[located.armIdx] > 0 ? entryClose / closes[located.armIdx] - 1 : null,
    correctionVol: sampleStdev(returns),
    correctionVolumeAccel: finite(prePeak) && prePeak > 0 && finite(during) ? during / prePeak : null,
  }
}

function position(closes, end, length) {
  if (end < length - 1) return null
  const slice = closes.slice(end - length + 1, end + 1)
  const low = Math.min(...slice)
  const high = Math.max(...slice)
  if (high === low) return null
  return (closes[end] - low) / (high - low)
}

export function priceStateBlock(closes, t0) {
  const prior = t0 - 1
  const ret = (days) => (prior >= days && closes[prior - days] > 0 ? closes[prior] / closes[prior - days] - 1 : null)
  const distance = (length) => {
    if (prior < length - 1) return null
    const average = windowMean(closes.slice(prior - length + 1, prior + 1))
    return average > 0 ? closes[prior] / average - 1 : null
  }
  return {
    ret5: ret(5),
    ret10: ret(10),
    ret20: ret(20),
    distMa20: distance(20),
    distMa50: distance(50),
    pos60: position(closes, prior, 60),
    pos120: position(closes, prior, 120),
  }
}

export function predictorBlock(series, entryIdx, t0Idx) {
  const volume = volumeBlock(series.volumes, t0Idx)
  const volatility = volatilityBlock(series.highs, series.lows, series.closes, t0Idx)
  const correction = correctionBlock(series.closes, series.volumes, entryIdx, t0Idx)
  const state = priceStateBlock(series.closes, t0Idx)
  return { ...volume, ...volatility, ...state, ...correction }
}

export function postEntryVolume(series, entryIdx, t0Idx, described) {
  const base = t0Idx >= 20 ? windowMean(series.volumes.slice(t0Idx - 20, t0Idx)) : null
  const endIdx = entryIdx + FORWARD_DAYS
  const ratioOver = (from, to) => {
    if (!finite(base) || base <= 0 || to > endIdx || from > to) return null
    const values = series.volumes.slice(from, to + 1)
    const average = windowMean(values)
    return finite(average) ? average / base : null
  }
  const fromLow = (milestone) => {
    if (described.lowDay == null || !described.rebound[milestone].reached) return null
    const lowIdx = t0Idx + described.lowDay
    const hit = lowIdx + described.rebound[milestone].days
    if (hit <= lowIdx) return null
    return ratioOver(lowIdx + 1, hit)
  }
  return {
    role: "descriptive",
    t1to3: ratioOver(t0Idx + 1, t0Idx + 3),
    t1to5: ratioOver(t0Idx + 1, t0Idx + 5),
    rebound5: fromLow("5"),
    rebound10: fromLow("10"),
  }
}

function counts(events) {
  return {
    HIGH: events.filter((event) => event.leadershipGroup === "HIGH").length,
    MID: events.filter((event) => event.leadershipGroup === "MID").length,
    LOW: events.filter((event) => event.leadershipGroup === "LOW").length,
  }
}

export function selectMildEvents(v6Events) {
  if (v6Events.length !== LOCKED_MILD_EVENTS) throw new Error(`v6 events ${v6Events.length} !== ${LOCKED_MILD_EVENTS}`)
  const seen = new Set()
  for (const event of v6Events) {
    if (seen.has(event.eventId)) throw new Error(`duplicate ${event.eventId}`)
    seen.add(event.eventId)
    if (!(event.t0 >= -0.05) || !(event.t0 < 0)) throw new Error(`T0 outside range ${event.eventId}`)
  }
  const found = counts(v6Events)
  for (const key of Object.keys(LOCKED_MILD_GROUPS)) {
    if (found[key] !== LOCKED_MILD_GROUPS[key]) throw new Error(`${key} ${found[key]} !== ${LOCKED_MILD_GROUPS[key]}`)
  }
  return v6Events.map((event) => ({ ...event }))
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

export function attachStudy(events, seriesBySymbol) {
  return events.map((event) => {
    const series = seriesBySymbol.get(event.ticker)
    if (!series) throw new Error(`missing series ${event.ticker}`)
    const entryIdx = dateIndex(series.dates, event.episodeStart)
    const t0Idx = dateIndex(series.dates, event.t0Date)
    if (entryIdx < 0 || t0Idx < 0) throw new Error(`missing dates ${event.eventId}`)
    const described = describeRebound(series.closes, entryIdx, t0Idx, series.closes[entryIdx])
    if (described.lowDay !== event.lowDay) throw new Error(`lowDay mismatch ${event.eventId}`)
    if (Math.abs((described.lowToWindowReturn ?? NaN) - (event.lowToWindowReturn ?? NaN)) > 1e-8) {
      throw new Error(`window rebound mismatch ${event.eventId}`)
    }
    const predictors = predictorBlock(series, entryIdx, t0Idx)
    if (!predictors.matched) throw new Error(`correction path does not match ${event.eventId}`)
    const descriptive = postEntryVolume(series, entryIdx, t0Idx, described)
    return {
      ...event,
      predictors,
      descriptive,
      outcomes: {
        t10: described.afterLowFormed.t10,
        t20: described.afterLowFormed.t20,
        t40: described.afterLowFormed.t40,
        window: described.afterLowFormed.windowEnd,
        hit10: described.rebound["10"].reached ? 1 : 0,
        hit15: described.rebound["15"].reached ? 1 : 0,
        hit20: described.rebound["20"].reached ? 1 : 0,
      },
    }
  })
}

function level(values) {
  const xs = values.filter(finite)
  return { n: xs.length, avg: round4(mean(xs)), median: round4(median(xs)) }
}

function diff(left, right) {
  if (!finite(left) || !finite(right)) return null
  return round4(left - right)
}

export function predictorTable(events) {
  return PREDICTORS.map((spec) => {
    const read = (event) => event.predictors[spec.id]
    const all = level(events.map(read))
    const high = level(events.filter((event) => event.leadershipGroup === "HIGH").map(read))
    const mid = level(events.filter((event) => event.leadershipGroup === "MID").map(read))
    const low = level(events.filter((event) => event.leadershipGroup === "LOW").map(read))
    return {
      ...spec,
      role: "predictor",
      missing: events.length - all.n,
      all,
      HIGH: high,
      MID: mid,
      LOW: low,
      highMinusLow: diff(high.avg, low.avg),
    }
  })
}

const OUTCOMES = ["t10", "t20", "t40", "window", "hit10", "hit15", "hit20"]

export function correlatePredictors(events) {
  return PREDICTORS.map((spec) => {
    const links = {}
    for (const outcome of OUTCOMES) {
      links[outcome] = spearman(
        events
          .map((event) => ({ x: event.predictors[spec.id], y: event.outcomes[outcome] }))
          .filter((pair) => finite(pair.x) && finite(pair.y)),
      )
    }
    links.leadership = spearman(
      events
        .map((event) => ({ x: event.predictors[spec.id], y: event.leadershipScore }))
        .filter((pair) => finite(pair.x) && finite(pair.y)),
    )
    return { id: spec.id, ...links }
  })
}

export function rankCandidates(table, correlations) {
  const byId = new Map(correlations.map((row) => [row.id, row]))
  const ranked = table
    .filter((row) => row.role === "predictor" && finite(byId.get(row.id)?.window?.rho) && byId.get(row.id).window.n >= 30)
    .map((row) => {
      const rho = byId.get(row.id).window.rho
      const gap = row.highMinusLow
      const consistent = finite(gap) && finite(rho) && Math.sign(gap) === Math.sign(rho) && gap !== 0 && rho !== 0
      return { id: row.id, label: row.label, rho, n: byId.get(row.id).window.n, highMinusLow: gap, missing: row.missing, consistent }
    })
    .sort((a, b) => Number(b.consistent) - Number(a.consistent) || Math.abs(b.rho) - Math.abs(a.rho))
  return ranked.slice(0, 5)
}

function solveLinear(matrix, vector) {
  const n = vector.length
  const a = matrix.map((row, index) => [...row, vector[index]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let row = col + 1; row < n; row++) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row
    if (Math.abs(a[pivot][col]) < 1e-12) return null
    const swap = a[col]
    a[col] = a[pivot]
    a[pivot] = swap
    const div = a[col][col]
    for (let j = col; j <= n; j++) a[col][j] /= div
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = a[row][col]
      for (let j = col; j <= n; j++) a[row][j] -= factor * a[col][j]
    }
  }
  return a.map((row) => row[n])
}

export function fitModel(rows, keys) {
  const usable = rows.filter((row) => finite(row.y) && keys.every((key) => finite(row[key])))
  const n = usable.length
  const p = keys.length + 1
  if (n <= p) return { n, keys, r2: null, adjustedR2: null }
  const xtx = Array.from({ length: p }, () => Array(p).fill(0))
  const xty = Array(p).fill(0)
  for (const row of usable) {
    const x = [1, ...keys.map((key) => row[key])]
    for (let i = 0; i < p; i++) {
      xty[i] += x[i] * row.y
      for (let j = 0; j < p; j++) xtx[i][j] += x[i] * x[j]
    }
  }
  const beta = solveLinear(xtx, xty)
  if (!beta) return { n, keys, r2: null, adjustedR2: null }
  const center = mean(usable.map((row) => row.y))
  let sse = 0
  let sst = 0
  for (const row of usable) {
    const fitted = beta[0] + keys.reduce((sum, key, index) => sum + beta[index + 1] * row[key], 0)
    sse += (row.y - fitted) ** 2
    sst += (row.y - center) ** 2
  }
  const r2 = sst === 0 ? null : 1 - sse / sst
  const adjustedR2 = r2 == null || n <= p ? null : 1 - ((1 - r2) * (n - 1)) / (n - p)
  return {
    n,
    keys,
    r2: round4(r2),
    adjustedR2: round4(adjustedR2),
    coefficients: [{ name: "intercept", coefficient: round4(beta[0]) }, ...keys.map((key, index) => ({ name: key, coefficient: round4(beta[index + 1]) }))],
  }
}

export function modelRows(events) {
  return events.map((event) => ({
    ticker: event.ticker,
    y: finite(event.outcomes.window) ? event.outcomes.window * 100 : null,
    t0: event.t0 * 100,
    leadership: event.leadershipScore,
    volumeRatio20: event.predictors.volumeRatio20,
    atrPct: finite(event.predictors.atrPct) ? event.predictors.atrPct * 100 : null,
    correctionSpeed: finite(event.predictors.correctionSpeed) ? event.predictors.correctionSpeed * 100 : null,
  }))
}

const MODEL_SPECS = [
  { id: "0", label: "T0", keys: ["t0"] },
  { id: "1", label: "T0 + leadership", keys: ["t0", "leadership"] },
  { id: "2", label: "T0 + leadership + volume", keys: ["t0", "leadership", MODEL_VOLUME] },
  { id: "3", label: "T0 + leadership + volume + volatility", keys: ["t0", "leadership", MODEL_VOLUME, MODEL_VOLATILITY] },
  { id: "4", label: "T0 + leadership + volume + volatility + correction speed", keys: ["t0", "leadership", MODEL_VOLUME, MODEL_VOLATILITY, MODEL_SPEED] },
]

export function compareModels(events) {
  const rows = modelRows(events)
  const own = MODEL_SPECS.map((spec) => ({ ...spec, sample: "available", ...fitModel(rows, spec.keys) }))
  const commonKeys = MODEL_SPECS[4].keys
  const common = rows.filter((row) => finite(row.y) && commonKeys.every((key) => finite(row[key])))
  const shared = MODEL_SPECS.map((spec) => ({ ...spec, sample: "common", ...fitModel(common, spec.keys) }))
  return { own, shared, note: "R-squared compares description of the stored window rebound. Repeated events from the same ticker are not independent observations." }
}

function tickerMean(events, read) {
  const groups = new Map()
  for (const event of events) {
    const value = read(event)
    if (!finite(value)) continue
    if (!groups.has(event.ticker)) groups.set(event.ticker, [])
    groups.get(event.ticker).push(value)
  }
  const means = [...groups.values()].map((values) => mean(values))
  return { tickers: means.length, avg: round4(mean(means)) }
}

export function stockWeightedPredictors(events) {
  return PREDICTORS.map((spec) => {
    const high = tickerMean(events.filter((event) => event.leadershipGroup === "HIGH"), (event) => event.predictors[spec.id])
    const low = tickerMean(events.filter((event) => event.leadershipGroup === "LOW"), (event) => event.predictors[spec.id])
    return {
      id: spec.id,
      highTickers: high.tickers,
      lowTickers: low.tickers,
      high: high.avg,
      low: low.avg,
      highMinusLow: diff(high.avg, low.avg),
      judgment: sampleJudgment(Math.min(high.tickers, low.tickers)),
    }
  })
}

export function leaveOneCorrelation(events, xRead, yRead, universe = EQUITY_SELL_RESEARCH_UNIVERSE) {
  const pairs = (rows) => rows.map((event) => ({ x: xRead(event), y: yRead(event) })).filter((pair) => finite(pair.x) && finite(pair.y))
  const baseline = spearman(pairs(events))
  const rows = universe.map((item) => {
    const ticker = item.symbol || item
    const removed = events.filter((event) => event.ticker === ticker).length
    const next = spearman(pairs(events.filter((event) => event.ticker !== ticker)))
    return { ticker, removed, rho: next.rho, n: next.n }
  })
  if (rows.reduce((sum, row) => sum + row.removed, 0) !== events.length) {
    throw new Error("leave-one-ticker-out removals do not add up to the study sample")
  }
  const active = rows.filter((row) => row.removed > 0 && finite(row.rho))
  const flips = active.filter((row) => finite(baseline.rho) && Math.sign(row.rho) !== Math.sign(baseline.rho) && row.rho !== 0 && baseline.rho !== 0)
  return {
    baseline,
    min: active.length ? round4(Math.min(...active.map((row) => row.rho))) : null,
    max: active.length ? round4(Math.max(...active.map((row) => row.rho))) : null,
    median: round4(median(active.map((row) => row.rho))),
    signFlips: flips.map((row) => row.ticker),
    rows,
  }
}
