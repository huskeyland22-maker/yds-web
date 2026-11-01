/**
 * US single-stock ATR percentile study v8 (research only).
 *
 * Compares the correction-day ATR(14)/price with that stock's own prior
 * 60- and 120-session distribution. The current day is not inside the
 * reference window. No sell rule is selected.
 */

import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./equity-sell-research-universe.mjs"
import { mean, median, spearman } from "./equity-sell-backtest-v2.mjs"
import { describeRebound } from "./equity-sell-backtest-v6.mjs"
import { loadOhlcv, selectMildEvents, volatilityBlock } from "./equity-sell-backtest-v7.mjs"

export { EQUITY_SELL_RESEARCH_UNIVERSE, selectMildEvents, loadOhlcv }

export const SELECTED_STRATEGY = null
export const WINDOWS = [60, 120]

function round2(value) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 100) / 100
}

function round4(value) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 10000) / 10000
}

export function atrPctAt(highs, lows, closes, index) {
  return volatilityBlock(highs, lows, closes, index).atrPct
}

export function percentileAgainstPast(current, past) {
  if (!Number.isFinite(current) || past.length < 2 || past.some((value) => !Number.isFinite(value))) return null
  let below = 0
  let equal = 0
  for (const value of past) {
    if (value < current) below += 1
    else if (value === current) equal += 1
  }
  return ((below + equal / 2) / past.length) * 100
}

export function decileOf(percentile) {
  if (!Number.isFinite(percentile)) return null
  if (percentile >= 100) return 10
  return Math.floor(percentile / 10) + 1
}

export function atrHistory(highs, lows, closes, t0, length) {
  const current = atrPctAt(highs, lows, closes, t0)
  const start = t0 - length
  if (start < 14 || !Number.isFinite(current)) {
    return { current, percentile: null, decile: null, usualMedian: null, ratio: null, n: 0 }
  }
  const past = []
  for (let index = start; index < t0; index++) {
    const value = atrPctAt(highs, lows, closes, index)
    if (!Number.isFinite(value)) return { current, percentile: null, decile: null, usualMedian: null, ratio: null, n: 0 }
    past.push(value)
  }
  const percentile = percentileAgainstPast(current, past)
  const usualMedian = median(past)
  return {
    current,
    percentile,
    decile: decileOf(percentile),
    usualMedian,
    ratio: usualMedian > 0 ? current / usualMedian : null,
    n: past.length,
  }
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

export function attachAtrHistory(events, seriesBySymbol) {
  return events.map((event) => {
    const series = seriesBySymbol.get(event.ticker)
    if (!series) throw new Error(`missing series ${event.ticker}`)
    const entryIdx = dateIndex(series.dates, event.episodeStart)
    const t0Idx = dateIndex(series.dates, event.t0Date)
    if (entryIdx < 0 || t0Idx < 0) throw new Error(`missing dates ${event.eventId}`)
    const described = describeRebound(series.closes, entryIdx, t0Idx, series.closes[entryIdx])
    if (described.lowDay !== event.lowDay) throw new Error(`lowDay mismatch ${event.eventId}`)
    const history = {}
    for (const length of WINDOWS) history[length] = atrHistory(series.highs, series.lows, series.closes, t0Idx, length)
    const current = history[60].current
    if (current !== history[120].current) throw new Error(`ATR changed with the window ${event.eventId}`)
    return {
      ...event,
      atrPct: current,
      history,
      windowRebound: described.afterLowFormed.windowEnd,
    }
  })
}

function level(values) {
  const xs = values.filter((value) => Number.isFinite(value))
  return { n: xs.length, avg: round2(mean(xs)), median: round2(median(xs)) }
}

function diff(left, right) {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null
  return round2(left - right)
}

export function summarizeHistory(events) {
  const groups = ["HIGH", "MID", "LOW"]
  return WINDOWS.map((length) => {
    const read = (event, key) => event.history[length][key]
    const block = (key, scale = 1) => {
      const row = {}
      for (const group of groups) {
        const stats = level(events.filter((event) => event.leadershipGroup === group).map((event) => read(event, key)).map((value) => (Number.isFinite(value) ? value * scale : value)))
        row[group] = stats
      }
      row.all = level(events.map((event) => read(event, key)).map((value) => (Number.isFinite(value) ? value * scale : value)))
      row.highMinusLow = diff(row.HIGH.avg, row.LOW.avg)
      return row
    }
    const aboveUsual = (group) => {
      const rows = events.filter((event) => !group || event.leadershipGroup === group).map((event) => event.history[length].percentile).filter((value) => Number.isFinite(value))
      const n = rows.filter((value) => value > 50).length
      return { n: rows.length, above: n, rate: rows.length ? round2((n / rows.length) * 100) : null }
    }
    return {
      length,
      percentile: block("percentile"),
      decile: block("decile"),
      usualMedian: block("usualMedian", 100),
      current: block("current", 100),
      ratio: block("ratio"),
      aboveUsual: { all: aboveUsual(null), HIGH: aboveUsual("HIGH"), MID: aboveUsual("MID"), LOW: aboveUsual("LOW") },
      missing: events.filter((event) => !Number.isFinite(event.history[length].percentile)).length,
    }
  })
}

export function correlateHistory(events) {
  const link = (xRead) => ({
    window: spearman(events.map((event) => ({ x: xRead(event), y: event.windowRebound })).filter((pair) => Number.isFinite(pair.x) && Number.isFinite(pair.y))),
    leadership: spearman(events.map((event) => ({ x: xRead(event), y: event.leadershipScore })).filter((pair) => Number.isFinite(pair.x) && Number.isFinite(pair.y))),
    atrPct: spearman(events.map((event) => ({ x: xRead(event), y: event.atrPct })).filter((pair) => Number.isFinite(pair.x) && Number.isFinite(pair.y))),
  })
  const out = {
    atrPct: link((event) => event.atrPct),
  }
  for (const length of WINDOWS) {
    out[`percentile${length}`] = link((event) => event.history[length].percentile)
    out[`usual${length}`] = link((event) => event.history[length].usualMedian)
  }
  return out
}
