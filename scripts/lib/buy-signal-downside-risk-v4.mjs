/**
 * Research only. Asks whether information known on the signal day
 * separates the v3 continued-decline path.
 * Rules and the -5% bar are fixed here, before the test period is read.
 * The path label is an evaluation target, not a same-day input.
 */

import { TRAIN_FRACTION, chronologicalSplit, classifyPath, pathSnapshot, priorFeatures, summarizeValues } from "./buy-signal-price-path-v3.mjs"

export const SELECTED_STRATEGY = null
export const PRIOR_DROP = -0.05
export const MIN_TEST_N = 30
export const TICKER_MIN = 5

function finite(value) {
  return Number.isFinite(value)
}

function sampleStd(values) {
  if (values.length < 2) return null
  const mid = values.reduce((sum, value) => sum + value, 0) / values.length
  const square = values.reduce((sum, value) => sum + (value - mid) ** 2, 0)
  return Math.sqrt(square / (values.length - 1))
}

function returnStd(rows, end, days) {
  if (end - days < 0) return null
  const returns = []
  for (let cursor = end - days + 1; cursor <= end; cursor += 1) {
    const previous = rows[cursor - 1].close
    if (!(previous > 0) || !finite(rows[cursor].close)) return null
    returns.push(rows[cursor].close / previous - 1)
  }
  return sampleStd(returns)
}

function closeVersusSma(rows, index, period) {
  if (index + 1 < period) return null
  let sum = 0
  for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
    if (!finite(rows[cursor].close)) return null
    sum += rows[cursor].close
  }
  const average = sum / period
  if (!(average > 0)) return null
  return rows[index].close / average - 1
}

export function newLowCount(rows, index, days = 5) {
  if (index < days + days - 1) return null
  let count = 0
  for (let day = index - days + 1; day <= index; day += 1) {
    if (!finite(rows[day].low)) return null
    let floor = Infinity
    for (let cursor = day - days; cursor < day; cursor += 1) {
      if (!finite(rows[cursor].low)) return null
      floor = Math.min(floor, rows[cursor].low)
    }
    if (rows[day].low < floor) count += 1
  }
  return count
}

export function downsideFeatures(rows, index) {
  const prior = priorFeatures(rows, index)
  const recentVol = returnStd(rows, index, 5)
  const previousVol = returnStd(rows, index - 5, 5)
  return {
    priorReturn1: prior.priorReturn[1],
    priorReturn3: prior.priorReturn[3],
    priorReturn5: prior.priorReturn[5],
    priorReturn10: prior.priorReturn[10],
    priorNewLow5: prior.priorNewLow5,
    priorNewLow10: prior.priorNewLow10,
    newLowCount5: newLowCount(rows, index, 5),
    vol5: recentVol,
    vol10: returnStd(rows, index, 10),
    volExpanded: recentVol == null || previousVol == null ? null : recentVol > previousVol,
    closeVsSma20: closeVersusSma(rows, index, 20),
    closeVsSma50: closeVersusSma(rows, index, 50),
    rsi14: prior.rsi14,
    ma20DevPct: prior.ma20DevPct,
    stochK: finite(rows[index].stochK) ? rows[index].stochK : null,
    bbPctB: finite(rows[index].bbPctB) ? rows[index].bbPctB : null,
  }
}

export function downsideLabel(rows, index) {
  const snapshot = pathSnapshot(rows, index)
  if (!snapshot.complete10) return null
  return classifyPath(snapshot) === "B"
}

export function rulePrior5(features) {
  if (features.priorReturn5 == null) return null
  return features.priorReturn5 <= PRIOR_DROP
}

export function ruleNewLow(features) {
  if (features.priorNewLow5 == null) return null
  return features.priorNewLow5 === true
}

export function ruleVolExpand(features) {
  if (features.volExpanded == null) return null
  return features.volExpanded === true
}

export function ruleCombo(features) {
  const prior = rulePrior5(features)
  const low = ruleNewLow(features)
  const vol = ruleVolExpand(features)
  if (prior == null || low == null || vol == null) return null
  return prior && low && vol
}

export const RULES = [
  ["prior5", rulePrior5],
  ["newLow", ruleNewLow],
  ["volExpand", ruleVolExpand],
  ["combo", ruleCombo],
]

export function confusion(events, rule) {
  let tp = 0
  let fp = 0
  let tn = 0
  let fn = 0
  let missing = 0
  for (const event of events) {
    const flagged = rule(event.features)
    if (flagged == null) {
      missing += 1
      continue
    }
    if (flagged && event.downside) tp += 1
    else if (flagged) fp += 1
    else if (event.downside) fn += 1
    else tn += 1
  }
  const predicted = tp + fp
  const actual = tp + fn
  const negatives = fp + tn
  const n = tp + fp + tn + fn
  return {
    n,
    missing,
    tp,
    fp,
    tn,
    fn,
    baseRate: n ? actual / n : null,
    precision: predicted ? tp / predicted : null,
    recall: actual ? tp / actual : null,
    falsePositiveRate: negatives ? fp / negatives : null,
  }
}

function horizonValues(events, horizon) {
  return events.filter((event) => event.nextOpen?.[horizon]?.complete).map((event) => event.nextOpen[horizon].return)
}

export function splitPerformance(events, rule) {
  const usable = []
  let missing = 0
  for (const event of events) {
    const flagged = rule(event.features)
    if (flagged == null) {
      missing += 1
      continue
    }
    usable.push({ event, flagged })
  }
  const group = (rows, horizon) => summarizeValues(horizonValues(rows, horizon))
  const all = usable.map((row) => row.event)
  const kept = usable.filter((row) => !row.flagged).map((row) => row.event)
  const excluded = usable.filter((row) => row.flagged).map((row) => row.event)
  return {
    missing,
    all: { t20: group(all, 20), t60: group(all, 60), adverse: summarizeValues(all.map((event) => event.adverseLow)) },
    kept: { t20: group(kept, 20), t60: group(kept, 60), adverse: summarizeValues(kept.map((event) => event.adverseLow)) },
    excluded: { t20: group(excluded, 20), t60: group(excluded, 60), adverse: summarizeValues(excluded.map((event) => event.adverseLow)) },
  }
}

export function passesPreRegisteredBar(score, performance) {
  if (!score || score.n < MIN_TEST_N) return false
  if (!(score.precision > score.baseRate)) return false
  const kept20 = performance.kept.t20.median
  const all20 = performance.all.t20.median
  const kept60 = performance.kept.t60.median
  const all60 = performance.all.t60.median
  const excluded60 = performance.excluded.t60.median
  if (kept20 == null || all20 == null || kept60 == null || all60 == null) return false
  if (!(kept20 > all20 && kept60 > all60)) return false
  if (excluded60 != null && !(excluded60 < kept60)) return false
  return true
}

export function tickerGaps(events, rule) {
  const bySymbol = new Map()
  for (const event of events) {
    if (rule(event.features) == null) continue
    if (!bySymbol.has(event.symbol)) bySymbol.set(event.symbol, [])
    bySymbol.get(event.symbol).push(event)
  }
  const gaps = []
  let improved = 0
  let worsened = 0
  let tied = 0
  for (const [symbol, rows] of bySymbol) {
    if (rows.length < TICKER_MIN) continue
    const kept = rows.filter((event) => rule(event.features) === false)
    const allMedian = summarizeValues(horizonValues(rows, 60)).median
    const keptMedian = summarizeValues(horizonValues(kept, 60)).median
    if (allMedian == null || keptMedian == null) continue
    const gap = keptMedian - allMedian
    gaps.push({ symbol, n: rows.length, gap })
    if (gap > 0) improved += 1
    else if (gap < 0) worsened += 1
    else tied += 1
  }
  return {
    tickers: gaps.length,
    improved,
    worsened,
    tied,
    medianGap: summarizeValues(gaps.map((row) => row.gap)).median,
  }
}

export function splitEvents(events) {
  return chronologicalSplit(events, TRAIN_FRACTION)
}

const PROFILE_KEYS = [
  "priorReturn1",
  "priorReturn3",
  "priorReturn5",
  "priorReturn10",
  "newLowCount5",
  "vol5",
  "vol10",
  "closeVsSma20",
  "closeVsSma50",
  "rsi14",
  "ma20DevPct",
  "stochK",
  "bbPctB",
]

export function featureProfile(events) {
  const side = (rows) => {
    const numeric = {}
    for (const key of PROFILE_KEYS) numeric[key] = summarizeValues(rows.map((event) => event.features[key]))
    const rate = (key) => summarizeValues(rows.map((event) => (event.features[key] == null ? null : event.features[key] ? 1 : 0)))
    return {
      n: rows.length,
      numeric,
      priorNewLow5: rate("priorNewLow5"),
      priorNewLow10: rate("priorNewLow10"),
      volExpanded: rate("volExpanded"),
    }
  }
  return {
    downside: side(events.filter((event) => event.downside)),
    other: side(events.filter((event) => !event.downside)),
    note: "train description only; these medians do not set a test rule",
  }
}
