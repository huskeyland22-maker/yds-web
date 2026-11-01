/**
 * ETF sell backtest v2 (research only).
 *
 * Same buy events as v1: rising-edge count>=3, no overlap, 60 sessions after entry.
 * Fixed sleeves sell at the first later close that reaches the target.
 * The trailing sleeve sells only on its own rule, after fixed sleeves are checked
 * that day. The peak is the highest close from the entry day through today.
 * No rule is selected.
 */

import { percentile } from "./daily-bottom-buy-validation-core.mjs"
import {
  DAILY_BOTTOM_BUY_ETFS,
  FORWARD_DAYS,
  SELL_CANDIDATES,
  buildSellEvents,
  median,
  simulateSell,
} from "./etf-sell-backtest.mjs"

export {
  DAILY_BOTTOM_BUY_ETFS,
  FORWARD_DAYS,
  SELL_CANDIDATES,
  buildSellEvents,
  simulateSell,
}

const WEIGHT_EPS = 1e-9

/** Recorded order. Fixed sleeves first, then the trailing sleeve. */
export const SAME_DAY_ORDER =
  "update close-peak through today; fill fixed targets in ascending order; then sell the trailing sleeve if its rule is true"

export const TRAIL_RULES = [
  { id: "T1", label: "T1 -5%", kind: "dd", dd: 0.05 },
  { id: "T2", label: "T2 -7%", kind: "dd", dd: 0.07 },
  { id: "T3", label: "T3 -10%", kind: "dd", dd: 0.1 },
  { id: "T4", label: "T4 MA20", kind: "ma" },
  { id: "T5", label: "T5 -7%&MA20", kind: "both", dd: 0.07 },
  { id: "T6", label: "T6 -10%&MA20", kind: "both", dd: 0.1 },
]

export const TRAIL_STRUCTURES = [
  {
    id: "10t",
    label: "10/Trailing",
    legs: [{ target: 0.1, weight: 0.5 }],
    trailWeight: 0.5,
  },
  {
    id: "15t",
    label: "15/Trailing",
    legs: [{ target: 0.15, weight: 0.5 }],
    trailWeight: 0.5,
  },
  {
    id: "1015t",
    label: "10/15/Trailing",
    legs: [
      { target: 0.1, weight: 0.3 },
      { target: 0.15, weight: 0.3 },
    ],
    trailWeight: 0.4,
  },
  {
    id: "1020t",
    label: "10/20/Trailing",
    legs: [
      { target: 0.1, weight: 0.3 },
      { target: 0.2, weight: 0.3 },
    ],
    trailWeight: 0.4,
  },
  {
    id: "1520t",
    label: "15/20/Trailing",
    legs: [
      { target: 0.15, weight: 0.3 },
      { target: 0.2, weight: 0.3 },
    ],
    trailWeight: 0.4,
  },
]

export const V2_SPECS = TRAIL_STRUCTURES.flatMap((structure) =>
  TRAIL_RULES.map((rule) => ({
    id: `${structure.id}-${rule.id}`,
    label: `${structure.label} ${rule.label}`,
    structure,
    rule,
  })),
)

function round2(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 100) / 100
}

function pctPoints(fraction) {
  if (fraction == null || !Number.isFinite(fraction)) return null
  return round2(fraction * 100)
}

function mean(values) {
  const xs = values.filter((v) => Number.isFinite(v))
  if (!xs.length) return null
  return xs.reduce((sum, v) => sum + v, 0) / xs.length
}

function hitsTarget(close, entry, target) {
  if (!(entry > 0) || !Number.isFinite(close)) return false
  return (close - entry) / entry + 1e-12 >= target
}

export function drawdownFromPeak(close, peak) {
  if (!(peak > 0) || !Number.isFinite(close)) return null
  return (peak - close) / peak
}

export function trailRuleMet(close, peak, ma20, rule) {
  const dd = drawdownFromPeak(close, peak)
  const ddHit = dd != null && dd + 1e-12 >= rule.dd
  const maHit = Number.isFinite(ma20) && close < ma20
  if (rule.kind === "dd") return ddHit
  if (rule.kind === "ma") return maHit
  if (rule.kind === "both") return ddHit && maHit
  return false
}

/**
 * One session, after the peak has already been updated with today's close.
 * Fixed target sleeves fill before the trailing sleeve. Unfilled target
 * sleeves are not sold by the trailing rule.
 */
export function decideSession({ close, entry, peak, ma20, pendingLegs, trailWeight, rule }) {
  const fixed = []
  for (const leg of pendingLegs) {
    if (hitsTarget(close, entry, leg.target)) fixed.push(leg)
  }
  const trail = trailWeight > WEIGHT_EPS && trailRuleMet(close, peak, ma20, rule)
  return { fixed, trail }
}

function missedAfter(closes, fromIdx, end, sellPrice, entry, weight) {
  let maxClose = null
  for (let j = fromIdx; j <= end && j < closes.length; j++) {
    if (maxClose == null || closes[j] > maxClose) maxClose = closes[j]
  }
  if (maxClose == null) return 0
  return weight * Math.max(0, (maxClose - sellPrice) / entry)
}

export function simulateTrailing(rows, entryIdx, horizon, structure, rule) {
  const entry = rows[entryIdx].close
  const end = Math.min(rows.length - 1, entryIdx + horizon)
  const closes = rows.map((row) => row.close)
  const pending = structure.legs.map((leg) => ({ ...leg }))
  let trailWeight = structure.trailWeight
  const fills = []
  let peak = entry
  let sameDayFixedAndTrail = 0

  for (let j = entryIdx + 1; j <= end; j++) {
    const close = closes[j]
    if (close > peak) peak = close
    const decision = decideSession({
      close,
      entry,
      peak,
      ma20: rows[j].ma20,
      pendingLegs: pending,
      trailWeight,
      rule,
    })
    for (const leg of decision.fixed) {
      pending.splice(pending.indexOf(leg), 1)
      fills.push({
        idx: j,
        days: j - entryIdx,
        date: rows[j].date ?? null,
        price: close,
        weight: leg.weight,
        role: "target",
        target: leg.target,
      })
    }
    if (decision.trail) {
      fills.push({
        idx: j,
        days: j - entryIdx,
        date: rows[j].date ?? null,
        price: close,
        weight: trailWeight,
        role: "trail",
        target: null,
      })
      trailWeight = 0
    }
    if (decision.fixed.length && decision.trail) sameDayFixedAndTrail += 1
    if (!pending.length && trailWeight <= WEIGHT_EPS) break
  }

  const openWeight = pending.reduce((sum, leg) => sum + leg.weight, 0) + trailWeight
  let realized = 0
  let missedUpside = 0
  for (const fill of fills) {
    realized += fill.weight * ((fill.price - entry) / entry)
    missedUpside += missedAfter(closes, fill.idx + 1, end, fill.price, entry, fill.weight)
  }
  const unrealized = openWeight * ((closes[end] - entry) / entry)
  const completed = openWeight <= WEIGHT_EPS
  const lastFill = fills.length ? fills[fills.length - 1] : null
  return {
    realized,
    unrealized,
    total: realized + unrealized,
    completed,
    openWeight,
    holdDays: completed && lastFill ? lastFill.days : horizon,
    lastSellDays: lastFill ? lastFill.days : null,
    lastSellDate: lastFill ? lastFill.date : null,
    missedUpside,
    sameDayFixedAndTrail,
    fills,
  }
}

function share(flags) {
  if (!flags.length) return null
  return (flags.filter(Boolean).length / flags.length) * 100
}

export function summarizeTrailing(spec, pairs) {
  const outcomes = pairs.map((pair) => pair.outcome)
  const events = pairs.map((pair) => pair.event)
  const total = outcomes.map((row) => row.total)
  const realized = outcomes.map((row) => row.realized)
  const days = outcomes.map((row) => row.holdDays)
  const missed = outcomes.map((row) => row.missedUpside)
  const etfs = DAILY_BOTTOM_BUY_ETFS.map((meta) => summarizeEtf(meta.symbol, pairs))
  const etfAvgs = etfs.map((row) => row.avgTotal).filter((v) => Number.isFinite(v))
  return {
    id: spec.id,
    label: spec.label,
    structure: spec.structure.label,
    trail: spec.rule.label,
    events: outcomes.length,
    completed: outcomes.filter((row) => row.completed).length,
    completionRate: round2(share(outcomes.map((row) => row.completed))),
    avgTotal: pctPoints(mean(total)),
    medianTotal: pctPoints(median(total)),
    winRate: round2(share(total.map((v) => v > 0))),
    avgRealized: pctPoints(mean(realized)),
    medianRealized: pctPoints(median(realized)),
    avgDays: round2(mean(days)),
    medianDays: round2(median(days)),
    maxDays: days.length ? Math.max(...days) : null,
    maxLoss: pctPoints(total.length ? Math.min(...total) : null),
    p25: pctPoints(percentile(total, 25)),
    p75: pctPoints(percentile(total, 75)),
    ge10: round2(share(total.map((v) => v >= 0.1 - WEIGHT_EPS))),
    ge15: round2(share(total.map((v) => v >= 0.15 - WEIGHT_EPS))),
    ge20: round2(share(total.map((v) => v >= 0.2 - WEIGHT_EPS))),
    ge25: round2(share(total.map((v) => v >= 0.25 - WEIGHT_EPS))),
    medianMfe: pctPoints(median(events.map((event) => event.mfe))),
    medianMae: pctPoints(median(events.map((event) => event.mae))),
    avgMissedUpside: pctPoints(mean(missed)),
    medianMissedUpside: pctPoints(median(missed)),
    avgOpenWeight: round2(mean(outcomes.map((row) => row.openWeight)) * 100),
    sameDayFixedAndTrail: outcomes.reduce((sum, row) => sum + row.sameDayFixedAndTrail, 0),
    etfAvgMin: pctPoints(etfAvgs.length ? Math.min(...etfAvgs) / 100 : null),
    etfAvgMax: pctPoints(etfAvgs.length ? Math.max(...etfAvgs) / 100 : null),
    etfs,
  }
}

function summarizeEtf(symbol, pairs) {
  const mine = pairs.filter((pair) => pair.event.etf === symbol)
  const total = mine.map((pair) => pair.outcome.total)
  const missed = mine.map((pair) => pair.outcome.missedUpside)
  return {
    etf: symbol,
    events: mine.length,
    completionRate: round2(share(mine.map((pair) => pair.outcome.completed))),
    avgTotal: pctPoints(mean(total)),
    medianTotal: pctPoints(median(total)),
    winRate: round2(share(total.map((v) => v > 0))),
    medianMfe: pctPoints(median(mine.map((pair) => pair.event.mfe))),
    medianMae: pctPoints(median(mine.map((pair) => pair.event.mae))),
    avgMissedUpside: pctPoints(mean(missed)),
  }
}

export function analyzeSymbolV2(symbol, rows, horizon = FORWARD_DAYS) {
  const built = buildSellEvents(rows, horizon)
  for (const event of built.events) event.etf = symbol
  const closes = rows.map((row) => row.close)
  const strategies = {}
  for (const spec of V2_SPECS) {
    strategies[spec.id] = built.events.map((event) =>
      simulateTrailing(rows, event.entryIdx, horizon, spec.structure, spec.rule),
    )
  }
  const baseline = {}
  for (const candidate of SELL_CANDIDATES) {
    if (candidate.kind !== "target") continue
    baseline[candidate.id] = built.events.map((event) =>
      simulateSell(closes, event.entryIdx, horizon, candidate),
    )
  }
  return {
    symbol,
    episodeCount: built.episodes.length,
    incomplete: built.incomplete,
    events: built.events,
    strategies,
    baseline,
  }
}

export function poolV2(parts) {
  const events = parts.flatMap((part) => part.events)
  const strategies = V2_SPECS.map((spec) => {
    const pairs = parts.flatMap((part) =>
      part.events.map((event, index) => ({
        event,
        outcome: part.strategies[spec.id][index],
      })),
    )
    return summarizeTrailing(spec, pairs)
  })
  const baseline = SELL_CANDIDATES.filter((candidate) => candidate.kind === "target").map((candidate) => {
    const outcomes = parts.flatMap((part) => part.baseline[candidate.id])
    const realized = outcomes.map((row) => row.realized)
    const missed = outcomes.map((row) => row.missedUpside)
    return {
      id: candidate.id,
      label: candidate.label,
      events: outcomes.length,
      completed: outcomes.filter((row) => row.completed).length,
      completionRate: round2(share(outcomes.map((row) => row.completed))),
      avgTotal: pctPoints(mean(realized)),
      medianTotal: pctPoints(median(realized)),
      winRate: round2(share(realized.map((v) => v > 0))),
      maxLoss: pctPoints(realized.length ? Math.min(...realized) : null),
      avgMissedUpside: pctPoints(mean(missed)),
      medianMissedUpside: pctPoints(median(missed)),
      avgDays: round2(mean(outcomes.map((row) => row.holdDays))),
      medianDays: round2(median(outcomes.map((row) => row.holdDays))),
    }
  })
  const dates = events.map((event) => event.signalDate).filter(Boolean).sort()
  return {
    events,
    strategies,
    baseline,
    episodeCount: parts.reduce((sum, part) => sum + part.episodeCount, 0),
    incomplete: parts.reduce((sum, part) => sum + part.incomplete, 0),
    firstSignal: dates[0] ?? null,
    lastSignal: dates[dates.length - 1] ?? null,
  }
}

function pad(value, width) {
  const text = value == null || value === "" ? "—" : String(value)
  return text.length >= width ? text : text + " ".repeat(width - text.length)
}

export function formatV2Table(rows) {
  const header = [
    pad("Strategy", 28),
    pad("N", 5),
    pad("Done", 5),
    pad("Comp%", 7),
    pad("Avg", 7),
    pad("Med", 7),
    pad("Win%", 7),
    pad("Real", 7),
    pad("Days", 6),
    pad("MaxLoss", 8),
    pad("P25", 7),
    pad("P75", 7),
    pad(">=10", 6),
    pad(">=20", 6),
    pad("Miss", 6),
    pad("ETFsp", 7),
  ].join(" ")
  const lines = [header]
  for (const row of rows) {
    const spread =
      row.etfAvgMax == null || row.etfAvgMin == null ? null : round2(row.etfAvgMax - row.etfAvgMin)
    lines.push(
      [
        pad(row.label, 28),
        pad(row.events, 5),
        pad(row.completed, 5),
        pad(row.completionRate, 7),
        pad(row.avgTotal, 7),
        pad(row.medianTotal, 7),
        pad(row.winRate, 7),
        pad(row.avgRealized, 7),
        pad(row.avgDays, 6),
        pad(row.maxLoss, 8),
        pad(row.p25, 7),
        pad(row.p75, 7),
        pad(row.ge10, 6),
        pad(row.ge20, 6),
        pad(row.avgMissedUpside, 6),
        pad(spread, 7),
      ].join(" "),
    )
  }
  return lines.join("\n")
}

export function formatEtfBlocks(strategies) {
  const blocks = []
  for (const strategy of strategies) {
    const header = [
      pad(strategy.label, 28),
      pad("ETF", 6),
      pad("N", 4),
      pad("Comp%", 7),
      pad("Avg", 7),
      pad("Med", 7),
      pad("Win%", 7),
      pad("MFE", 7),
      pad("MAE", 7),
      pad("Miss", 7),
    ].join(" ")
    const lines = [header]
    for (const row of strategy.etfs) {
      lines.push(
        [
          pad("", 28),
          pad(row.etf, 6),
          pad(row.events, 4),
          pad(row.completionRate, 7),
          pad(row.avgTotal, 7),
          pad(row.medianTotal, 7),
          pad(row.winRate, 7),
          pad(row.medianMfe, 7),
          pad(row.medianMae, 7),
          pad(row.avgMissedUpside, 7),
        ].join(" "),
      )
    }
    blocks.push(lines.join("\n"))
  }
  return blocks.join("\n\n")
}
