/**
 * Research only. 3/4+ signals confirmed inside a 5-trading-day window.
 * Does not change production buy rules or prior result files.
 *
 * Window:
 * - Opens on a rising edge (count goes from below 3 to 3 or more).
 * - Lasts 5 trading days including that day.
 * - Each day with count >= 3 is one hit, including consecutive days.
 * - A later rise inside the same 5 days is another hit, not a new window.
 * - The next window can start only after this window, and only on a new rising edge.
 * - One entry per strategy per window. Later windows may overlap the holding period.
 *
 * Fill:
 * - The signal uses that day's close.
 * - The fill is the next session's open. The signal close is not an entry price.
 * - No fee or slippage in the primary result. A 0.20% round-trip is sensitivity only.
 */

import { conditionFlags } from "./daily-bottom-buy-validation-core.mjs"
import { FROZEN_THRESHOLDS, buildSplitBuyEpisodes } from "./daily-bottom-split-buy-sim.mjs"

export const SELECTED_STRATEGY = null
export const WINDOW_DAYS = 5
export const HORIZONS = [20, 60, 120]
export const REQUIRED_HITS = { A: 1, B: 2, C: 3 }
export const FEE_ROUND_TRIP = 0.002
export const PAIRED_MIN = 30
export const MDD_TOLERANCE = 0.03

export function thresholdsMatchRequest(th = FROZEN_THRESHOLDS) {
  return th.rsiMax === 36 && th.stochKMax === 15.4 && th.bbPctBMax === 0.01 && th.ma20DevMax === -4.2
}

export function buildConfirmWindows(rows, th = FROZEN_THRESHOLDS, windowDays = WINDOW_DAYS) {
  const windows = []
  let prev = 0
  let i = 0
  while (i < rows.length) {
    const count = conditionFlags(rows[i], th).count
    if (!(count >= 3 && prev < 3)) {
      prev = count
      i += 1
      continue
    }
    const start = i
    const last = Math.min(rows.length - 1, start + windowDays - 1)
    const hits = []
    for (let j = start; j <= last; j += 1) {
      if (conditionFlags(rows[j], th).count >= 3) hits.push(j)
    }
    windows.push({ start, last, hits })
    prev = conditionFlags(rows[last], th).count
    i = last + 1
  }
  return windows
}

export function measureFromOpen(rows, fill, entryPrice, horizons = HORIZONS) {
  const out = {}
  for (const horizon of horizons) {
    const exit = fill + horizon
    if (exit >= rows.length || !(entryPrice > 0)) {
      out[horizon] = { complete: false, return: null, mdd: null }
      continue
    }
    let mdd = 0
    for (let cursor = fill; cursor <= exit; cursor += 1) {
      const change = rows[cursor].close / entryPrice - 1
      if (change < mdd) mdd = change
    }
    out[horizon] = {
      complete: true,
      return: rows[exit].close / entryPrice - 1,
      mdd,
    }
  }
  return out
}

export function strategyEntries(rows, window) {
  const out = {}
  for (const id of Object.keys(REQUIRED_HITS)) {
    const need = REQUIRED_HITS[id]
    if (window.hits.length < need) {
      out[id] = { entered: false, reason: "hits_short" }
      continue
    }
    const confirm = window.hits[need - 1]
    const fill = confirm + 1
    if (fill >= rows.length) {
      out[id] = { entered: false, reason: "no_next_bar", confirm }
      continue
    }
    const entryPrice = rows[fill].open
    if (!Number.isFinite(entryPrice) || !(entryPrice > 0)) {
      out[id] = { entered: false, reason: "open_missing", confirm, fill }
      continue
    }
    out[id] = {
      entered: true,
      confirm,
      fill,
      entryPrice,
      waitDays: fill - window.start,
      horizons: measureFromOpen(rows, fill, entryPrice),
    }
  }
  return out
}

export function legacyRisingEdgeEntries(rows, th = FROZEN_THRESHOLDS) {
  const episodes = buildSplitBuyEpisodes(rows, th, { fromIdx: 0, toIdx: rows.length })
  const entries = []
  let noNext = 0
  let openMissing = 0
  for (const episode of episodes) {
    const fill = episode.openIdx + 1
    if (fill >= rows.length) {
      noNext += 1
      continue
    }
    const entryPrice = rows[fill].open
    if (!Number.isFinite(entryPrice) || !(entryPrice > 0)) {
      openMissing += 1
      continue
    }
    entries.push({
      signal: episode.openIdx,
      fill,
      entryPrice,
      waitDays: 1,
      horizons: measureFromOpen(rows, fill, entryPrice),
    })
  }
  return { episodes: episodes.length, entries, noNext, openMissing }
}

function mean(values) {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2) return sorted[mid]
  return (sorted[mid - 1] + sorted[mid]) / 2
}

export function horizonStats(entries, horizon) {
  const complete = entries.filter((row) => row.horizons?.[horizon]?.complete)
  const returns = complete.map((row) => row.horizons[horizon].return)
  const drawdowns = complete.map((row) => row.horizons[horizon].mdd)
  return {
    n: returns.length,
    incomplete: entries.length - returns.length,
    mean: mean(returns),
    median: median(returns),
    winRate: returns.length ? returns.filter((value) => value > 0).length / returns.length : null,
    mddMean: mean(drawdowns),
    mddMedian: median(drawdowns),
  }
}

export function waitStats(entries) {
  const values = entries.map((row) => row.waitDays).filter((value) => Number.isFinite(value))
  return { n: values.length, mean: mean(values), median: median(values) }
}

function feeStats(entries, horizon) {
  const base = horizonStats(entries, horizon)
  const complete = entries.filter((row) => row.horizons?.[horizon]?.complete)
  const net = complete.map((row) => row.horizons[horizon].return - FEE_ROUND_TRIP)
  return {
    ...base,
    mean: mean(net),
    median: median(net),
    winRate: net.length ? net.filter((value) => value > 0).length / net.length : null,
  }
}

export function summarizeStrategy(entries) {
  const horizons = {}
  const net = {}
  for (const horizon of HORIZONS) {
    horizons[horizon] = horizonStats(entries, horizon)
    net[horizon] = feeStats(entries, horizon)
  }
  return {
    entries: entries.length,
    wait: waitStats(entries),
    horizons,
    feeSensitivity: net,
  }
}

export function compareToFirstSignal(windows) {
  const paired = { B: [], C: [] }
  const missed = { B: [], C: [] }
  for (const window of windows) {
    const a = window.strategies.A
    const aEntry = a?.entered ? a : null
    for (const id of ["B", "C"]) {
      const other = window.strategies[id]
      if (aEntry && other?.entered) paired[id].push({ window, a: aEntry, other })
      else if (aEntry && !other?.entered) missed[id].push({ window, a: aEntry, reason: other?.reason || "not_entered" })
    }
  }
  return {
    B: pairSummary(paired.B, missed.B),
    C: pairSummary(paired.C, missed.C),
  }
}

function pairSummary(pairs, missedRows) {
  const horizons = {}
  for (const horizon of HORIZONS) {
    const both = pairs.filter((row) => row.a.horizons[horizon].complete && row.other.horizons[horizon].complete)
    const aReturns = both.map((row) => row.a.horizons[horizon].return)
    const bReturns = both.map((row) => row.other.horizons[horizon].return)
    const gaps = both.map((row) => row.other.horizons[horizon].return - row.a.horizons[horizon].return)
    const aMdd = both.map((row) => row.a.horizons[horizon].mdd)
    const bMdd = both.map((row) => row.other.horizons[horizon].mdd)
    const skipped = missedRows.filter((row) => row.a.horizons[horizon].complete)
    const skippedReturns = skipped.map((row) => row.a.horizons[horizon].return)
    horizons[horizon] = {
      n: both.length,
      a: {
        mean: mean(aReturns),
        median: median(aReturns),
        winRate: aReturns.length ? aReturns.filter((value) => value > 0).length / aReturns.length : null,
        mddMean: mean(aMdd),
      },
      other: {
        mean: mean(bReturns),
        median: median(bReturns),
        winRate: bReturns.length ? bReturns.filter((value) => value > 0).length / bReturns.length : null,
        mddMean: mean(bMdd),
      },
      meanGap: mean(gaps),
      medianGap: median(gaps),
      missedN: skippedReturns.length,
      missedAMean: mean(skippedReturns),
      missedAMedian: median(skippedReturns),
    }
  }
  const delays = pairs.map((row) => row.other.fill - row.a.fill)
  const waitMoves = pairs.map((row) => row.other.entryPrice / row.a.entryPrice - 1)
  return {
    pairedEntries: pairs.length,
    missedEntries: missedRows.length,
    delayDays: { mean: mean(delays), median: median(delays) },
    moveBeforeLaterEntry: { mean: mean(waitMoves), median: median(waitMoves) },
    horizons,
    judgment: judgeImprovement(horizons),
  }
}

export function judgeImprovement(horizons) {
  const t60 = horizons[60]
  const t120 = horizons[120]
  if (!t60 || !t120 || t60.n < PAIRED_MIN || t120.n < PAIRED_MIN) return "판단 보류"
  const medianBetter = t60.other.median > t60.a.median && t120.other.median > t120.a.median
  const meanBetter = t60.other.mean > t60.a.mean && t120.other.mean > t120.a.mean
  const mddOk = t60.other.mddMean >= t60.a.mddMean - MDD_TOLERANCE && t120.other.mddMean >= t120.a.mddMean - MDD_TOLERANCE
  const skippedWeaker = t60.missedN === 0 || (t60.missedAMedian != null && t60.missedAMedian <= t60.a.median)
  if (medianBetter && meanBetter && mddOk && skippedWeaker) return "제한적 개선"
  if (meanBetter && !medianBetter) return "평균만 높음"
  return "개선되지 않음"
}

export function groupCounts(rows, keyOf) {
  const groups = new Map()
  for (const row of rows) {
    const key = keyOf(row)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  return [...groups.entries()]
    .map(([key, entries]) => ({
      key,
      entries: entries.length,
      t60: horizonStats(entries, 60),
    }))
    .sort((a, b) => b.entries - a.entries || String(a.key).localeCompare(String(b.key)))
}

export function sameCloseLegacyStats(rows, th = FROZEN_THRESHOLDS) {
  const episodes = buildSplitBuyEpisodes(rows, th, { fromIdx: 0, toIdx: rows.length })
  const direct = {}
  for (const horizon of HORIZONS) {
    const values = []
    const drawdowns = []
    for (const episode of episodes) {
      const exit = episode.openIdx + horizon
      const base = rows[episode.openIdx].close
      if (exit >= rows.length || !(base > 0)) continue
      let mdd = 0
      for (let cursor = episode.openIdx; cursor <= exit; cursor += 1) {
        const change = rows[cursor].close / base - 1
        if (change < mdd) mdd = change
      }
      values.push(rows[exit].close / base - 1)
      drawdowns.push(mdd)
    }
    direct[horizon] = {
      n: values.length,
      mean: mean(values),
      median: median(values),
      winRate: values.length ? values.filter((value) => value > 0).length / values.length : null,
      mddMean: mean(drawdowns),
    }
  }
  return { episodes: episodes.length, horizons: direct }
}
