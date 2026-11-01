/**
 * US single-stock recovery-path study v3 (research only).
 *
 * Reuses the v2 +10/-10 events and their leadership groups.
 * New fields describe the path after T0. They are not fed back into the score.
 * No sell rule is selected.
 */

import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./equity-sell-research-universe.mjs"
import {
  LOCKED_DEEP_EVENTS,
  comparisonJudgment,
  eventIdentity,
  mean,
  median,
  sampleJudgment,
  spearman,
} from "./equity-sell-backtest-v2.mjs"

export { EQUITY_SELL_RESEARCH_UNIVERSE, LOCKED_DEEP_EVENTS }

export const SELECTED_STRATEGY = null
export const EPS = 1e-9
export const OFFSETS = [0, 1, 3, 5, 7, 10, 15, 20, 30, 40]
export const PATH_KEYS = ["t0", "t1", "t3", "t5", "t7", "t10", "t15", "t20", "t30", "t40", "windowEnd"]

function round2(value) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 100) / 100
}

function pct(fraction) {
  if (fraction == null || !Number.isFinite(fraction)) return null
  return round2(fraction * 100)
}

function share(flags) {
  if (!flags.length) return null
  return (flags.filter(Boolean).length / flags.length) * 100
}

export function dateIndex(dates, date) {
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

export function pathKey(offset) {
  return offset === 0 ? "t0" : `t${offset}`
}

/**
 * Returns are close / entryPrice - 1.
 * A horizon is null when that session falls outside the original entry+60 window.
 * The first entry recovery is kept even if price later falls back below entry.
 * The post-T0 low is the first minimum close after T0.
 */
export function measurePath(closes, entryIdx, t0Idx, entryPrice) {
  const endIdx = entryIdx + 60
  if (!(entryPrice > 0) || endIdx >= closes.length || t0Idx < entryIdx || t0Idx > endIdx) {
    throw new Error("path window is outside the stored episode")
  }
  const quotes = {}
  for (const offset of OFFSETS) {
    const idx = t0Idx + offset
    quotes[pathKey(offset)] = idx <= endIdx ? closes[idx] / entryPrice - 1 : null
  }
  const windowClose = closes[endIdx]
  const windowEnd = windowClose / entryPrice - 1

  let recoveryIdx = null
  if (closes[t0Idx] + EPS >= entryPrice) recoveryIdx = t0Idx
  else {
    for (let k = t0Idx + 1; k <= endIdx; k++) {
      if (closes[k] + EPS >= entryPrice) {
        recoveryIdx = k
        break
      }
    }
  }

  let minIdx = null
  let minClose = null
  for (let k = t0Idx + 1; k <= endIdx; k++) {
    if (minClose == null || closes[k] < minClose) {
      minClose = closes[k]
      minIdx = k
    }
  }
  const hasAfter = minIdx != null
  const additionalDrawdown = hasAfter ? Math.max(0, (closes[t0Idx] - minClose) / closes[t0Idx]) : null
  const lowVsEntry = hasAfter ? minClose / entryPrice - 1 : null
  const reboundFromLow = hasAfter && minClose > 0 ? (windowClose - minClose) / minClose : null
  const reboundVsEntry = hasAfter ? (windowClose - minClose) / entryPrice : null

  return {
    ...quotes,
    windowEnd,
    daysToEntry: recoveryIdx == null ? null : recoveryIdx - t0Idx,
    recovered: recoveryIdx != null,
    daysToLow: hasAfter ? minIdx - t0Idx : null,
    additionalDrawdown,
    lowVsEntry,
    reboundFromLow,
    reboundVsEntry,
    hasAfter,
  }
}

function closeEnough(left, right) {
  if (left == null && right == null) return true
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false
  return Math.abs(left - right) <= 1e-8 + 1e-6 * Math.abs(right)
}

export function attachPaths(events, seriesBySymbol) {
  if (events.length !== LOCKED_DEEP_EVENTS) throw new Error(`events ${events.length} !== ${LOCKED_DEEP_EVENTS}`)
  return events.map((event) => {
    const series = seriesBySymbol.get(event.ticker)
    if (!series) throw new Error(`missing series ${event.ticker}`)
    const entryIdx = dateIndex(series.dates, event.episodeStart)
    const t0Idx = dateIndex(series.dates, event.t0Date)
    if (entryIdx < 0 || t0Idx < 0) throw new Error(`${event.ticker} missing ${event.episodeStart} or ${event.t0Date}`)
    if (!closeEnough(series.closes[entryIdx], event.entryPrice) || !closeEnough(series.closes[t0Idx], event.t0Close)) {
      throw new Error(`${event.ticker} price mismatch at ${event.t0Date}`)
    }
    const measured = measurePath(series.closes, entryIdx, t0Idx, event.entryPrice)
    if (!closeEnough(measured.windowEnd, event.windowEnd?.vsEntry)) {
      throw new Error(`${event.ticker} window end mismatch ${event.t0Date}`)
    }
    if (!closeEnough(measured.t5, event.t5?.vsEntry ?? null) || !closeEnough(measured.t20, event.t20?.vsEntry ?? null)) {
      throw new Error(`${event.ticker} stored horizon mismatch ${event.t0Date}`)
    }
    if (!closeEnough(measured.additionalDrawdown, event.additionalDrawdown)) {
      throw new Error(`${event.ticker} additional drawdown mismatch ${event.t0Date}`)
    }
    return {
      ticker: event.ticker,
      episodeStart: event.episodeStart,
      plus10Date: event.plus10Date,
      t0Date: event.t0Date,
      t0Close: event.t0Close,
      entryPrice: event.entryPrice,
      correctionDepth: event.correctionDepth,
      leadershipScore: event.leadershipScore,
      leadershipGroup: event.leadershipGroup,
      entryRecoveredV2: event.entryRecovered,
      ...measured,
    }
  })
}

export function assertSameEvents(v2Events, v3Events) {
  if (v2Events.length !== v3Events.length) throw new Error("event count changed")
  for (let i = 0; i < v2Events.length; i++) {
    const left = eventIdentity(v2Events[i]).join("|")
    const right = eventIdentity(v3Events[i]).join("|")
    if (left !== right) throw new Error(`event identity mismatch at ${i}`)
    if (v2Events[i].leadershipGroup !== v3Events[i].leadershipGroup) throw new Error(`group mismatch ${right}`)
    if (v2Events[i].leadershipScore !== v3Events[i].leadershipScore) throw new Error(`score mismatch ${right}`)
  }
}

function horizonStats(events, key) {
  const values = events.map((event) => event[key]).filter((value) => Number.isFinite(value))
  return {
    n: values.length,
    avg: pct(mean(values)),
    median: pct(median(values)),
    winRate: round2(share(values.map((value) => value > 0))),
    judgment: sampleJudgment(values.length),
  }
}

function numberStats(events, key, scale = 1) {
  const values = events.map((event) => event[key]).filter((value) => Number.isFinite(value))
  return {
    n: values.length,
    avg: round2(mean(values) == null ? null : mean(values) * scale),
    median: round2(median(values) == null ? null : median(values) * scale),
    judgment: sampleJudgment(values.length),
  }
}

export function summarizePath(events) {
  const horizons = {}
  for (const key of PATH_KEYS) horizons[key] = horizonStats(events, key)
  const recoveredDays = events.map((event) => event.daysToEntry).filter((value) => Number.isFinite(value))
  const lowDays = events.map((event) => event.daysToLow).filter((value) => Number.isFinite(value))
  const splitRows = events.filter(
    (event) => Number.isFinite(event.lowVsEntry) && Number.isFinite(event.reboundVsEntry) && Number.isFinite(event.windowEnd),
  )
  return {
    n: events.length,
    judgment: sampleJudgment(events.length),
    horizons,
    recovery: {
      n: events.length,
      recovered: recoveredDays.length,
      avgDays: round2(mean(recoveredDays)),
      medianDays: round2(median(recoveredDays)),
      within5: round2(share(events.map((event) => event.daysToEntry != null && event.daysToEntry <= 5))),
      within10: round2(share(events.map((event) => event.daysToEntry != null && event.daysToEntry <= 10))),
      within20: round2(share(events.map((event) => event.daysToEntry != null && event.daysToEntry <= 20))),
      withinWindow: round2(share(events.map((event) => event.recovered === true))),
      judgment: sampleJudgment(events.length),
    },
    low: {
      n: lowDays.length,
      avgDays: round2(mean(lowDays)),
      medianDays: round2(median(lowDays)),
      by5: round2(share(events.map((event) => event.daysToLow != null && event.daysToLow <= 5))),
      by10: round2(share(events.map((event) => event.daysToLow != null && event.daysToLow <= 10))),
      by20: round2(share(events.map((event) => event.daysToLow != null && event.daysToLow <= 20))),
      judgment: sampleJudgment(lowDays.length),
    },
    additionalDrawdown: numberStats(events, "additionalDrawdown", 100),
    lowVsEntry: numberStats(events, "lowVsEntry", 100),
    reboundFromLow: numberStats(events, "reboundFromLow", 100),
    reboundVsEntry: numberStats(events, "reboundVsEntry", 100),
    split: {
      n: splitRows.length,
      window: pct(mean(splitRows.map((event) => event.windowEnd))),
      lowVsEntry: pct(mean(splitRows.map((event) => event.lowVsEntry))),
      reboundVsEntry: pct(mean(splitRows.map((event) => event.reboundVsEntry))),
    },
  }
}

function byTicker(events) {
  const groups = new Map()
  for (const event of events) {
    if (!groups.has(event.ticker)) groups.set(event.ticker, [])
    groups.get(event.ticker).push(event)
  }
  return groups
}

function stockHorizon(events, key) {
  const means = []
  const medians = []
  const wins = []
  for (const rows of byTicker(events).values()) {
    const values = rows.map((event) => event[key]).filter((value) => Number.isFinite(value))
    if (!values.length) continue
    means.push(mean(values))
    medians.push(median(values))
    wins.push(values.filter((value) => value > 0).length / values.length)
  }
  return {
    stocks: means.length,
    avg: pct(mean(means)),
    median: pct(median(medians)),
    winRate: round2(mean(wins) == null ? null : mean(wins) * 100),
    judgment: sampleJudgment(means.length),
  }
}

function stockRate(events, pred) {
  const rates = []
  for (const rows of byTicker(events).values()) {
    if (!rows.length) continue
    rates.push(rows.filter(pred).length / rows.length)
  }
  return {
    stocks: rates.length,
    avg: round2(mean(rates) == null ? null : mean(rates) * 100),
    median: round2(median(rates) == null ? null : median(rates) * 100),
  }
}

function stockNumber(events, key, scale = 1) {
  const means = []
  const medians = []
  for (const rows of byTicker(events).values()) {
    const values = rows.map((event) => event[key]).filter((value) => Number.isFinite(value))
    if (!values.length) continue
    means.push(mean(values))
    medians.push(median(values))
  }
  return {
    stocks: means.length,
    avg: round2(mean(means) == null ? null : mean(means) * scale),
    median: round2(median(medians) == null ? null : median(medians) * scale),
  }
}

export function summarizeStockPath(events) {
  const horizons = {}
  for (const key of PATH_KEYS) horizons[key] = stockHorizon(events, key)
  return {
    n: events.length,
    stocks: new Set(events.map((event) => event.ticker)).size,
    horizons,
    recovery: {
      within5: stockRate(events, (event) => event.daysToEntry != null && event.daysToEntry <= 5),
      within10: stockRate(events, (event) => event.daysToEntry != null && event.daysToEntry <= 10),
      within20: stockRate(events, (event) => event.daysToEntry != null && event.daysToEntry <= 20),
      withinWindow: stockRate(events, (event) => event.recovered === true),
    },
    additionalDrawdown: stockNumber(events, "additionalDrawdown", 100),
    lowVsEntry: stockNumber(events, "lowVsEntry", 100),
    reboundFromLow: stockNumber(events, "reboundFromLow", 100),
    reboundVsEntry: stockNumber(events, "reboundVsEntry", 100),
  }
}

function diff(left, right) {
  if (left == null || right == null || !Number.isFinite(left) || !Number.isFinite(right)) return null
  return round2(left - right)
}

export function differencePath(high, low) {
  const out = {}
  for (const key of PATH_KEYS) {
    out[key] = {
      avg: diff(high.horizons[key].avg, low.horizons[key].avg),
      median: diff(high.horizons[key].median, low.horizons[key].median),
      winRate: diff(high.horizons[key].winRate, low.horizons[key].winRate),
      highN: high.horizons[key].n ?? high.horizons[key].stocks,
      lowN: low.horizons[key].n ?? low.horizons[key].stocks,
      judgment: comparisonJudgment(
        high.horizons[key].n ?? high.horizons[key].stocks,
        low.horizons[key].n ?? low.horizons[key].stocks,
      ),
    }
  }
  return out
}

function trajectoryOf(summary) {
  const meanRow = {}
  const medianRow = {}
  const winRow = {}
  const nRow = {}
  for (const key of PATH_KEYS) {
    meanRow[key] = summary.horizons[key].avg
    medianRow[key] = summary.horizons[key].median
    winRow[key] = summary.horizons[key].winRate
    nRow[key] = summary.horizons[key].n ?? summary.horizons[key].stocks
  }
  return { mean: meanRow, median: medianRow, winRate: winRow, n: nRow }
}

export function correlateScore(events) {
  const scored = events.filter((event) => Number.isFinite(event.leadershipScore))
  const out = {}
  for (const key of PATH_KEYS) {
    out[key] = spearman(
      scored.filter((event) => Number.isFinite(event[key])).map((event) => ({ x: event.leadershipScore, y: event[key] })),
    )
  }
  return out
}

export function analyzeTrajectories(events) {
  const buckets = {
    HIGH: events.filter((event) => event.leadershipGroup === "HIGH"),
    MID: events.filter((event) => event.leadershipGroup === "MID"),
    LOW: events.filter((event) => event.leadershipGroup === "LOW"),
  }
  const eventWeighted = {
    HIGH: summarizePath(buckets.HIGH),
    MID: summarizePath(buckets.MID),
    LOW: summarizePath(buckets.LOW),
  }
  const stockWeighted = {
    HIGH: summarizeStockPath(buckets.HIGH),
    MID: summarizeStockPath(buckets.MID),
    LOW: summarizeStockPath(buckets.LOW),
  }
  return {
    counts: { HIGH: buckets.HIGH.length, MID: buckets.MID.length, LOW: buckets.LOW.length },
    eventWeighted,
    stockWeighted,
    trajectory: {
      HIGH: trajectoryOf(eventWeighted.HIGH),
      MID: trajectoryOf(eventWeighted.MID),
      LOW: trajectoryOf(eventWeighted.LOW),
    },
    trajectoryStock: {
      HIGH: trajectoryOf(stockWeighted.HIGH),
      MID: trajectoryOf(stockWeighted.MID),
      LOW: trajectoryOf(stockWeighted.LOW),
    },
    highMinusLow: differencePath(eventWeighted.HIGH, eventWeighted.LOW),
    highMinusLowStock: differencePath(stockWeighted.HIGH, stockWeighted.LOW),
  }
}

export function summarizeSymbols(events) {
  return EQUITY_SELL_RESEARCH_UNIVERSE.map((meta) => {
    const rows = events.filter((event) => event.ticker === meta.symbol)
    const scores = rows.map((event) => event.leadershipScore).filter((value) => Number.isFinite(value))
    const path = {}
    for (const key of ["t1", "t3", "t5", "t7", "t10", "t15", "t20", "windowEnd"]) path[key] = horizonStats(rows, key)
    return {
      ticker: meta.symbol,
      n: rows.length,
      avgLeadershipScore: round2(mean(scores)),
      judgment: sampleJudgment(rows.length),
      path,
    }
  })
}
