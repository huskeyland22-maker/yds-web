/**
 * US single-stock post-low rebound speed study v11 (research only).
 *
 * Asks whether a higher correction-day ATR(14)/price lines up with a larger
 * rebound after the low, a faster rebound, or both. Hit times use only events
 * that reach the level. Misses are not filled in. No sell rule is selected.
 */

import { comparisonJudgment, mean, median, sampleJudgment, spearman } from "./equity-sell-backtest-v2.mjs"
import { leaveOneCorrelation } from "./equity-sell-backtest-v7.mjs"
import { partialSpearmanControls } from "./equity-sell-backtest-v9.mjs"
import { attachDepth, loadOhlcv, selectMildEvents } from "./equity-sell-backtest-v10.mjs"

export { loadOhlcv, selectMildEvents, leaveOneCorrelation }

export const SELECTED_STRATEGY = null
export const LOCKED_EVENTS = 103
export const LOCKED_GROUPS = { HIGH: 15, MID: 53, LOW: 35 }
export const HIT = 1e-12
export const TARGETS = [
  ["3", 0.03],
  ["5", 0.05],
  ["10", 0.1],
  ["15", 0.15],
  ["20", 0.2],
]
const CLOCKS = [3, 5, 10, 20]
const PARTIALS = [
  ["P1", ["t0"]],
  ["P2", ["leadership"]],
  ["P3", ["drawdown"]],
  ["P4", ["t0", "leadership"]],
  ["P5", ["t0", "leadership", "drawdown"]],
]

function round2(value) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 100) / 100
}

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

function quantile(values, p) {
  const xs = values.filter(finite).sort((a, b) => a - b)
  if (!xs.length) return null
  const index = (xs.length - 1) * p
  const lo = Math.floor(index)
  const hi = Math.ceil(index)
  if (lo === hi) return xs[lo]
  return xs[lo] * (hi - index) + xs[hi] * (index - lo)
}

export function hitDay(closes, lowIdx, endIdx, target) {
  const lowClose = closes[lowIdx]
  if (!(lowClose > 0) || lowIdx >= endIdx) return null
  for (let k = lowIdx + 1; k <= endIdx; k++) {
    if ((closes[k] - lowClose) / lowClose + HIT >= target) return k - lowIdx
  }
  return null
}

function emptyHits() {
  return Object.fromEntries(TARGETS.map(([key]) => [key, { reached: false, days: null }]))
}

export function attachSpeed(events, seriesBySymbol) {
  const base = attachDepth(events, seriesBySymbol)
  const tagged = base.map((event) => {
    const series = seriesBySymbol.get(event.ticker)
    const entryIdx = dateIndex(series.dates, event.episodeStart)
    const t0Idx = dateIndex(series.dates, event.t0Date)
    const endIdx = entryIdx + 60
    if (event.lowDay == null) {
      return { ...event, hits: emptyHits(), fromLow: {}, segments: {}, sessionsAfterLow: null }
    }
    const lowIdx = t0Idx + event.lowDay
    const lowClose = series.closes[lowIdx]
    const hits = {}
    for (const [key, target] of TARGETS) {
      const days = hitDay(series.closes, lowIdx, endIdx, target)
      hits[key] = { reached: days != null, days }
    }
    const at = (offset) => {
      const index = lowIdx + offset
      if (index > endIdx) return null
      return series.closes[index] / lowClose - 1
    }
    const closeAt = (offset) => (lowIdx + offset <= endIdx ? series.closes[lowIdx + offset] : null)
    const c5 = closeAt(5)
    const c10 = closeAt(10)
    const c20 = closeAt(20)
    return {
      ...event,
      hits,
      fromLow: { t3: at(3), t5: at(5), t10: at(10), t20: at(20) },
      segments: {
        early: at(5),
        mid: c5 != null && c10 != null ? (c10 - c5) / lowClose : null,
        late: c10 != null && c20 != null ? (c20 - c10) / lowClose : null,
      },
      sessionsAfterLow: endIdx - lowIdx,
    }
  })
  tagged.bandCounts = base.bandCounts
  return tagged
}

function statusOf(n) {
  if (n < 5) return "insufficient"
  if (n < 10) return "numbers_only"
  return "limited"
}

export function hitSummary(events) {
  const eligible = events.filter((event) => event.lowDay != null)
  const out = { eligible: eligible.length }
  for (const [key] of TARGETS) {
    const days = eligible.map((event) => event.hits[key].days).filter(finite)
    out[key] = {
      eligible: eligible.length,
      reached: days.length,
      rate: eligible.length ? round2((days.length / eligible.length) * 100) : null,
      avgDays: round2(mean(days)),
      medianDays: round2(median(days)),
      p25: round2(quantile(days, 0.25)),
      p75: round2(quantile(days, 0.75)),
      status: statusOf(days.length),
      rateStatus: statusOf(eligible.length),
    }
  }
  return out
}

function groupHitTable(events, keyOf) {
  const groups = ["LOW", "MID", "HIGH"]
  return TARGETS.map(([target]) => {
    const row = { target }
    for (const group of groups) {
      const members = events.filter((event) => keyOf(event) === group)
      row[group] = hitSummary(members)[target]
    }
    row.highMinusLowRate = gap(row.HIGH.rate, row.LOW.rate)
    row.medianDaysHighMinusLow = gap(row.HIGH.medianDays, row.LOW.medianDays)
    row.dayJudgment = comparisonJudgment(row.HIGH.reached, row.LOW.reached)
    return row
  })
}

function gap(left, right) {
  if (!finite(left) || !finite(right)) return null
  return round2(left - right)
}

export function atrHitTable(events) {
  return groupHitTable(events, (event) => event.atrBand)
}

export function leadershipHitTable(events) {
  return groupHitTable(events, (event) => event.leadershipGroup)
}

function pair(events, yRead) {
  return spearman(events.map((event) => ({ x: event.atrPct, y: yRead(event) })).filter((row) => finite(row.x) && finite(row.y)))
}

export function speedCorrelations(events) {
  const times = {}
  for (const [key] of TARGETS) times[key] = pair(events, (event) => event.hits[key].days)
  return {
    times,
    fromLow: {
      t5: pair(events, (event) => event.fromLow.t5),
      t10: pair(events, (event) => event.fromLow.t10),
      t20: pair(events, (event) => event.fromLow.t20),
      window: pair(events, (event) => event.lowToWindow),
    },
    segments: {
      early: pair(events, (event) => event.segments.early),
      mid: pair(events, (event) => event.segments.mid),
      late: pair(events, (event) => event.segments.late),
    },
  }
}

export function sizeSpeedTable(events) {
  const bands = ["LOW", "MID", "HIGH"].map((band) => {
    const rows = events.filter((event) => event.atrBand === band)
    const hits = hitSummary(rows)
    const level = (read) => {
      const values = rows.map(read).filter(finite)
      return { n: values.length, avg: round2(mean(values) == null ? null : mean(values) * 100), median: round2(median(values) == null ? null : median(values) * 100) }
    }
    return {
      band,
      n: rows.length,
      lowToWindow: level((event) => event.lowToWindow),
      lowToT10: level((event) => event.fromLow.t10),
      lowToT20: level((event) => event.fromLow.t20),
      hit5: hits["5"],
      hit10: hits["10"],
      hit20: hits["20"],
    }
  })
  const high = bands.find((row) => row.band === "HIGH")
  const low = bands.find((row) => row.band === "LOW")
  return {
    bands,
    highMinusLow: {
      lowToWindow: gap(high.lowToWindow.avg, low.lowToWindow.avg),
      lowToT10: gap(high.lowToT10.avg, low.lowToT10.avg),
      lowToT20: gap(high.lowToT20.avg, low.lowToT20.avg),
      hit5Rate: gap(high.hit5.rate, low.hit5.rate),
      hit10Rate: gap(high.hit10.rate, low.hit10.rate),
      hit20Rate: gap(high.hit20.rate, low.hit20.rate),
      hit5MedianDays: gap(high.hit5.medianDays, low.hit5.medianDays),
      hit10MedianDays: gap(high.hit10.medianDays, low.hit10.medianDays),
      hit20MedianDays: gap(high.hit20.medianDays, low.hit20.medianDays),
    },
  }
}

function snapshot(events, offset, target) {
  const eligible = events.filter((event) => finite(event.fromLow?.[`t${offset}`]))
  const hit = eligible.filter((event) => event.fromLow[`t${offset}`] + HIT >= target)
  return {
    n: eligible.length,
    hit: hit.length,
    rate: eligible.length ? round2((hit.length / eligible.length) * 100) : null,
    status: statusOf(eligible.length),
  }
}

export function fixedClockRates(events) {
  const targets = [0.05, 0.1, 0.2]
  return ["LOW", "MID", "HIGH"].map((band) => {
    const rows = events.filter((event) => event.atrBand === band)
    const clocks = {}
    for (const offset of CLOCKS) {
      clocks[offset] = {}
      for (const target of targets) clocks[offset][String(Math.round(target * 100))] = snapshot(rows, offset, target)
    }
    return { band, n: rows.length, clocks }
  })
}

export function withinRates(events) {
  const windows = [5, 10, 20]
  return ["LOW", "MID", "HIGH"].map((band) => {
    const rows = events.filter((event) => event.atrBand === band && event.lowDay != null)
    const rates = {}
    for (const limit of windows) {
      const eligible = rows.filter((event) => {
        const days = event.hits["10"].days
        if (days != null && days <= limit) return true
        return event.sessionsAfterLow >= limit
      })
      const hit = eligible.filter((event) => event.hits["10"].days != null && event.hits["10"].days <= limit)
      rates[limit] = {
        n: eligible.length,
        hit: hit.length,
        rate: eligible.length ? round2((hit.length / eligible.length) * 100) : null,
        status: statusOf(eligible.length),
      }
    }
    return { band, rates }
  })
}

function controlValue(event, key) {
  if (key === "leadership") return event.leadershipScore
  if (key === "t0") return event.t0
  return event[key]
}

export function speedPartials(events) {
  const out = {}
  for (const [target] of TARGETS) {
    out[target] = PARTIALS.map(([id, controls]) => {
      const rows = events
        .map((event) => ({
          x: event.atrPct,
          y: event.hits[target].days,
          controls: controls.map((key) => controlValue(event, key)),
        }))
        .filter((row) => finite(row.x) && finite(row.y) && row.controls.every(finite))
      const raw = spearman(rows.map((row) => ({ x: row.x, y: row.y })))
      const partial = partialSpearmanControls(rows)
      return { id, controls, rawRho: raw.rho, partialRho: partial.rho, n: partial.n }
    })
  }
  return out
}

export function leadershipAtrSpeed(events) {
  const cells = []
  for (const leadership of ["HIGH", "LOW"]) {
    for (const atr of ["HIGH", "LOW"]) {
      const rows = events.filter((event) => event.leadershipGroup === leadership && event.atrBand === atr)
      const hits = hitSummary(rows)
      const windowValues = rows.map((event) => event.lowToWindow).filter(finite)
      cells.push({
        leadership,
        atr,
        n: rows.length,
        status: statusOf(rows.length),
        hit5: hits["5"],
        hit10: hits["10"],
        hit20: hits["20"],
        lowToWindow: {
          n: windowValues.length,
          avg: round2(mean(windowValues) == null ? null : mean(windowValues) * 100),
          median: round2(median(windowValues) == null ? null : median(windowValues) * 100),
        },
      })
    }
  }
  return cells
}

export function judgeReboundShape(stats) {
  const usable = [stats.time5, stats.time10, stats.time20].filter((row) => row && row.n >= 10 && finite(row.rho))
  if (!finite(stats.windowRho) || usable.length < 2) {
    return { A: "표본 부족", B: "표본 부족", C: "표본 부족" }
  }
  const speedLinked = usable.filter((row) => row.rho <= -0.15).length >= 2
  const speedWeak = !speedLinked && usable.filter((row) => row.rho <= -0.05).length >= 2
  const sizeLinked = Math.abs(stats.windowRho) >= 0.2
  if (sizeLinked && speedLinked) return { A: "기각", B: "지지", C: "지지" }
  if (sizeLinked && speedWeak) return { A: "약한 지지", B: "약한 지지", C: "약한 지지" }
  if (sizeLinked) return { A: "지지", B: "기각", C: "기각" }
  if (speedLinked) return { A: "기각", B: "지지", C: "기각" }
  if (speedWeak) return { A: "기각", B: "약한 지지", C: "기각" }
  return { A: "기각", B: "기각", C: "기각" }
}
