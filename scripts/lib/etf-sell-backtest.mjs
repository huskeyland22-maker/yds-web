/**
 * ETF sell-strategy backtest (research only).
 *
 * Buy events reuse the existing split-buy episode:
 * rising edge of condition count >= 3, no overlap, later 4/4 only inside
 * that episode (EPISODE_DEF). This file does not change those rules.
 *
 * The 60-session window is used only to measure what happened after entry.
 * A sell day is the first later close that reaches that strategy's target.
 * Daily quote close is the price. No intraday limit fill is assumed.
 * Trend combination is a hook only — no indicator rule is set.
 */

import {
  DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1,
  DAILY_BOTTOM_THRESHOLDS,
} from "../../api/_lib/dailyBottomBuyEngine.js"
import { EPISODE_DEF, FROZEN_THRESHOLDS, buildSplitBuyEpisodes } from "./daily-bottom-split-buy-sim.mjs"

/** Research/backtest universe = frozen V1 nine (not the product six). */
const DAILY_BOTTOM_BUY_ETFS = DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1

export {
  DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1,
  DAILY_BOTTOM_BUY_ETFS,
  DAILY_BOTTOM_THRESHOLDS,
  EPISODE_DEF,
  FROZEN_THRESHOLDS,
}

export const FORWARD_DAYS = 60
export const PATH_TARGETS = [0.05, 0.1, 0.15, 0.2, 0.25]

/** Comparison candidates. None of these is a chosen sell rule. */
export const SELL_CANDIDATES = [
  { id: "tp10", label: "+10%", kind: "target", legs: [{ target: 0.1, weight: 1 }] },
  { id: "tp15", label: "+15%", kind: "target", legs: [{ target: 0.15, weight: 1 }] },
  { id: "tp20", label: "+20%", kind: "target", legs: [{ target: 0.2, weight: 1 }] },
  { id: "tp25", label: "+25%", kind: "target", legs: [{ target: 0.25, weight: 1 }] },
  {
    id: "split1015",
    label: "10/15 Split",
    kind: "target",
    legs: [
      { target: 0.1, weight: 0.5 },
      { target: 0.15, weight: 0.5 },
    ],
  },
  {
    id: "split101520",
    label: "10/15/20 Split",
    kind: "target",
    legs: [
      { target: 0.1, weight: 0.3 },
      { target: 0.15, weight: 0.3 },
      { target: 0.2, weight: 0.4 },
    ],
  },
  { id: "trend", label: "Trend", kind: "trend", rule: null },
]

const WEIGHT_EPS = 1e-9

export function productionThresholdsMatchFrozen() {
  return (
    DAILY_BOTTOM_THRESHOLDS.rsiMax === FROZEN_THRESHOLDS.rsiMax &&
    DAILY_BOTTOM_THRESHOLDS.stochKMax === FROZEN_THRESHOLDS.stochKMax &&
    DAILY_BOTTOM_THRESHOLDS.bbPctBMax === FROZEN_THRESHOLDS.bbPctBMax &&
    DAILY_BOTTOM_THRESHOLDS.ma20DevMax === FROZEN_THRESHOLDS.ma20DevMax
  )
}

function round2(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 100) / 100
}

function pctPoints(fraction) {
  if (fraction == null || !Number.isFinite(fraction)) return null
  return round2(fraction * 100)
}

export function median(values) {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (!xs.length) return null
  const mid = Math.floor(xs.length / 2)
  if (xs.length % 2) return xs[mid]
  return (xs[mid - 1] + xs[mid]) / 2
}

function mean(values) {
  const xs = values.filter((v) => Number.isFinite(v))
  if (!xs.length) return null
  return xs.reduce((s, v) => s + v, 0) / xs.length
}

/**
 * First close strictly after entryIdx that reaches entry * (1 + target).
 * Looks only through entryIdx + horizon.
 */
function hitsTarget(close, entry, target) {
  if (!(entry > 0) || !Number.isFinite(close)) return false
  return (close - entry) / entry + 1e-12 >= target
}

export function firstTargetTouch(closes, entryIdx, horizon, target) {
  const entry = closes[entryIdx]
  if (!(entry > 0)) return null
  const end = entryIdx + horizon
  for (let j = entryIdx + 1; j <= end && j < closes.length; j++) {
    if (hitsTarget(closes[j], entry, target)) {
      return { idx: j, days: j - entryIdx, price: closes[j] }
    }
  }
  return null
}

function extremeAfter(closes, fromIdx, endIdx) {
  let maxClose = null
  let minClose = null
  for (let j = fromIdx; j <= endIdx && j < closes.length; j++) {
    const c = closes[j]
    if (maxClose == null || c > maxClose) maxClose = c
    if (minClose == null || c < minClose) minClose = c
  }
  return { maxClose, minClose }
}

/**
 * @param {Array<{ close: number, date?: string }>} rows
 * @param {ReturnType<typeof buildSplitBuyEpisodes>[number]} episode
 * @param {number} horizon
 */
export function measureEvent(rows, episode, horizon = FORWARD_DAYS) {
  const entryIdx = episode.openIdx
  const entry = rows[entryIdx].close
  const end = entryIdx + horizon
  const closes = rows.map((r) => r.close)
  const later = extremeAfter(closes, entryIdx + 1, end)
  const mfe = later.maxClose == null ? null : (later.maxClose - entry) / entry
  const mae = later.minClose == null ? null : (entry - later.minClose) / entry

  const ret = {}
  for (const n of [5, 10, 20, 40, 60]) {
    const px = n <= horizon ? closes[entryIdx + n] : null
    ret[`d${n}`] = px == null || !(entry > 0) ? null : (px - entry) / entry
  }

  const hits = {}
  for (const target of PATH_TARGETS) {
    const key = Math.round(target * 100)
    const touch = firstTargetTouch(closes, entryIdx, horizon, target)
    hits[`hit${key}`] = touch != null
    hits[`daysTo${key}`] = touch ? touch.days : null
  }

  return {
    etf: episode.symbol ?? null,
    signalDate: episode.openDate,
    entryPrice: entry,
    entryIdx,
    entryCount: episode.openCount,
    threeOfFour: episode.openCount >= 3,
    laterFourOfFour: episode.reached4 === true,
    fourDate: episode.fill4Date ?? null,
    daysToFour: episode.daysTo4 ?? null,
    d5: ret.d5,
    d10: ret.d10,
    d20: ret.d20,
    d40: ret.d40,
    d60: ret.d60,
    mfe,
    mae,
    hit5: hits.hit5,
    hit10: hits.hit10,
    hit15: hits.hit15,
    hit20: hits.hit20,
    hit25: hits.hit25,
    daysTo5: hits.daysTo5,
    daysTo10: hits.daysTo10,
    daysTo15: hits.daysTo15,
    daysTo20: hits.daysTo20,
    daysTo25: hits.daysTo25,
  }
}

/**
 * Walk forward one session at a time. A target fills only when that day's
 * close is known. Same-day gaps fill every remaining leg whose target the
 * close already reaches, at that close.
 *
 * Unfilled weight is marked at the horizon close. That event is not a
 * completed target sell. Missed upside is the further rise, in entry-price
 * points, after each filled leg. Horizon marks have no post-exit path.
 */
export function simulateSell(closes, entryIdx, horizon, candidate) {
  if (candidate.kind === "trend") {
    if (typeof candidate.rule !== "function") return { configured: false }
    return simulateTrendRule(closes, entryIdx, horizon, candidate.rule)
  }

  const entry = closes[entryIdx]
  const end = Math.min(closes.length - 1, entryIdx + horizon)
  const legs = candidate.legs
  const fills = []
  let legIdx = 0
  for (let j = entryIdx + 1; j <= end && legIdx < legs.length; j++) {
    const close = closes[j]
    while (legIdx < legs.length && hitsTarget(close, entry, legs[legIdx].target)) {
      fills.push({
        idx: j,
        days: j - entryIdx,
        price: close,
        weight: legs[legIdx].weight,
        target: legs[legIdx].target,
      })
      legIdx += 1
    }
  }

  const filledWeight = fills.reduce((s, f) => s + f.weight, 0)
  const remainder = Math.max(0, 1 - filledWeight)
  const completed = remainder <= WEIGHT_EPS
  let realized = 0
  for (const fill of fills) realized += fill.weight * ((fill.price - entry) / entry)
  if (!completed) realized += remainder * ((closes[end] - entry) / entry)

  let missedUpside = 0
  let extraDrawdown = 0
  for (const fill of fills) {
    const after = extremeAfter(closes, fill.idx + 1, end)
    if (after.maxClose != null) {
      missedUpside += fill.weight * Math.max(0, (after.maxClose - fill.price) / entry)
    }
    if (after.minClose != null) {
      extraDrawdown += fill.weight * Math.max(0, (fill.price - after.minClose) / entry)
    }
  }

  const exitIdx = completed ? fills[fills.length - 1].idx : end
  return {
    configured: true,
    completed,
    realized,
    holdDays: exitIdx - entryIdx,
    missedUpside,
    extraDrawdown,
    fills,
  }
}

function simulateTrendRule(closes, entryIdx, horizon, rule) {
  const entry = closes[entryIdx]
  const end = Math.min(closes.length - 1, entryIdx + horizon)
  let sellIdx = null
  for (let j = entryIdx + 1; j <= end; j++) {
    const decision = rule({
      closes,
      index: j,
      entryIdx,
      entry,
      close: closes[j],
    })
    if (decision === true) {
      sellIdx = j
      break
    }
  }
  const exitIdx = sellIdx ?? end
  const exitPrice = closes[exitIdx]
  const after = extremeAfter(closes, exitIdx + 1, end)
  return {
    configured: true,
    completed: sellIdx != null,
    realized: (exitPrice - entry) / entry,
    holdDays: exitIdx - entryIdx,
    missedUpside:
      sellIdx == null || after.maxClose == null ? 0 : Math.max(0, (after.maxClose - exitPrice) / entry),
    extraDrawdown:
      sellIdx == null || after.minClose == null ? 0 : Math.max(0, (exitPrice - after.minClose) / entry),
    fills: sellIdx == null ? [] : [{ idx: sellIdx, days: sellIdx - entryIdx, price: exitPrice, weight: 1, target: null }],
  }
}

export function buildSellEvents(rows, horizon = FORWARD_DAYS) {
  const episodes = buildSplitBuyEpisodes(rows, FROZEN_THRESHOLDS, {
    fromIdx: 0,
    toIdx: rows.length,
  })
  const events = []
  let incomplete = 0
  for (const episode of episodes) {
    if (episode.openIdx + horizon >= rows.length) {
      incomplete += 1
      continue
    }
    if (!(rows[episode.openIdx].close > 0)) {
      incomplete += 1
      continue
    }
    events.push(measureEvent(rows, episode, horizon))
  }
  return { episodes, events, incomplete }
}

export function analyzeSymbol(symbol, rows, horizon = FORWARD_DAYS) {
  const built = buildSellEvents(rows, horizon)
  for (const event of built.events) event.etf = symbol
  const closes = rows.map((row) => row.close)
  /** @type {Record<string, ReturnType<typeof simulateSell>[] | null>} */
  const outcomes = {}
  for (const candidate of SELL_CANDIDATES) {
    if (candidate.kind === "trend" && typeof candidate.rule !== "function") {
      outcomes[candidate.id] = null
      continue
    }
    outcomes[candidate.id] = built.events.map((event) =>
      simulateSell(closes, event.entryIdx, horizon, candidate),
    )
  }
  return {
    symbol,
    episodeCount: built.episodes.length,
    incomplete: built.incomplete,
    events: built.events,
    outcomes,
  }
}

export function poolAnalysis(parts) {
  const events = parts.flatMap((part) => part.events)
  const strategies = SELL_CANDIDATES.map((candidate) => {
    if (candidate.kind === "trend" && typeof candidate.rule !== "function") {
      return { id: candidate.id, label: candidate.label, configured: false }
    }
    const outcomes = parts.flatMap((part) => part.outcomes[candidate.id] ?? [])
    return summarizeOutcomes(candidate, outcomes)
  })
  const etfs = DAILY_BOTTOM_BUY_ETFS.map((meta) => summarizeEtf(meta.symbol, events))
  const dates = events.map((event) => event.signalDate).filter(Boolean).sort()
  return {
    events,
    strategies,
    etfs,
    episodeCount: parts.reduce((sum, part) => sum + part.episodeCount, 0),
    incomplete: parts.reduce((sum, part) => sum + part.incomplete, 0),
    firstSignal: dates[0] ?? null,
    lastSignal: dates[dates.length - 1] ?? null,
  }
}

function share(flags) {
  if (!flags.length) return null
  return (flags.filter(Boolean).length / flags.length) * 100
}

export function summarizeOutcomes(candidate, outcomes) {
  const realized = outcomes.map((o) => o.realized)
  const days = outcomes.map((o) => o.holdDays)
  const missed = outcomes.map((o) => o.missedUpside)
  const extraDown = outcomes.map((o) => o.extraDrawdown)
  return {
    id: candidate.id,
    label: candidate.label,
    configured: true,
    events: outcomes.length,
    completed: outcomes.filter((o) => o.completed).length,
    avgReturn: pctPoints(mean(realized)),
    medianReturn: pctPoints(median(realized)),
    winRate: round2(share(realized.map((v) => v > 0))),
    maxLoss: pctPoints(realized.length ? Math.min(...realized) : null),
    avgDays: round2(mean(days)),
    medianDays: round2(median(days)),
    endedGe10: round2(share(realized.map((v) => v >= 0.1 - WEIGHT_EPS))),
    endedGe15: round2(share(realized.map((v) => v >= 0.15 - WEIGHT_EPS))),
    endedGe20: round2(share(realized.map((v) => v >= 0.2 - WEIGHT_EPS))),
    avgMissedUpside: pctPoints(mean(missed)),
    medianMissedUpside: pctPoints(median(missed)),
    avgExtraDrawdown: pctPoints(mean(extraDown)),
    medianExtraDrawdown: pctPoints(median(extraDown)),
  }
}

export function summarizeEtf(symbol, events) {
  const mine = events.filter((e) => e.etf === symbol)
  return {
    etf: symbol,
    events: mine.length,
    hit10: round2(share(mine.map((e) => e.hit10))),
    hit15: round2(share(mine.map((e) => e.hit15))),
    hit20: round2(share(mine.map((e) => e.hit20))),
    medianMfe: pctPoints(median(mine.map((e) => e.mfe))),
    medianMae: pctPoints(median(mine.map((e) => e.mae))),
  }
}

function pad(value, width) {
  const text = value == null || value === "" ? "—" : String(value)
  return text.length >= width ? text : text + " ".repeat(width - text.length)
}

export function formatStrategyTable(summaries) {
  const header = [
    pad("Strategy", 18),
    pad("Events", 8),
    pad("Done", 6),
    pad("Avg", 8),
    pad("Median", 8),
    pad("Win%", 8),
    pad("MaxLoss", 9),
    pad("AvgDays", 8),
    pad("MedDays", 8),
    pad(">=10", 7),
    pad(">=15", 7),
    pad(">=20", 7),
    pad("MissUp", 8),
    pad("ExtraDn", 8),
  ].join(" ")
  const lines = [header]
  for (const row of summaries) {
    if (!row.configured) {
      lines.push(`${pad(row.label, 18)} unconfigured`)
      continue
    }
    lines.push(
      [
        pad(row.label, 18),
        pad(row.events, 8),
        pad(row.completed, 6),
        pad(row.avgReturn, 8),
        pad(row.medianReturn, 8),
        pad(row.winRate, 8),
        pad(row.maxLoss, 9),
        pad(row.avgDays, 8),
        pad(row.medianDays, 8),
        pad(row.endedGe10, 7),
        pad(row.endedGe15, 7),
        pad(row.endedGe20, 7),
        pad(row.avgMissedUpside, 8),
        pad(row.avgExtraDrawdown, 8),
      ].join(" "),
    )
  }
  return lines.join("\n")
}

export function formatEtfTable(rows) {
  const header = [
    pad("ETF", 6),
    pad("Events", 8),
    pad("+10 Hit", 8),
    pad("+15 Hit", 8),
    pad("+20 Hit", 8),
    pad("Med MFE", 8),
    pad("Med MAE", 8),
  ].join(" ")
  const lines = [header]
  for (const row of rows) {
    lines.push(
      [
        pad(row.etf, 6),
        pad(row.events, 8),
        pad(row.hit10, 8),
        pad(row.hit15, 8),
        pad(row.hit20, 8),
        pad(row.medianMfe, 8),
        pad(row.medianMae, 8),
      ].join(" "),
    )
  }
  return lines.join("\n")
}
