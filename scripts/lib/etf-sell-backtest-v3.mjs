/**
 * ETF sell backtest v3 (research only).
 *
 * Same 3/4 episodes as v1. After a profit close is observed, the first later
 * close that is the stated percent below the highest close seen so far is the
 * pullback. The peak never includes a future close. No rule is selected.
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

export { DAILY_BOTTOM_BUY_ETFS, FORWARD_DAYS, buildSellEvents, simulateSell }

const EPS = 1e-9

export const PROFIT_ARMS = [0.05, 0.1, 0.15, 0.2, 0.25]
export const PULLBACKS = [0.03, 0.05, 0.07, 0.1, 0.12]
export const RECOVERY_WINDOW = 20

export const SELL_RULES = [
  { id: "S1", label: "S1 +10% then -5%", arm: 0.1, dd: 0.05 },
  { id: "S2", label: "S2 +10% then -7%", arm: 0.1, dd: 0.07 },
  { id: "S3", label: "S3 +15% then -5%", arm: 0.15, dd: 0.05 },
  { id: "S4", label: "S4 +15% then -7%", arm: 0.15, dd: 0.07 },
  { id: "S5", label: "S5 +20% then -7%", arm: 0.2, dd: 0.07 },
  { id: "S6", label: "S6 +15% then -10%", arm: 0.15, dd: 0.1 },
]

/** Comparison rows that are not a separate adopted rule. */
export const TRAIL_COMPARE = [
  { id: "C10d5", label: "+10% then -5%", arm: 0.1, dd: 0.05 },
  { id: "C10d7", label: "+10% then -7%", arm: 0.1, dd: 0.07 },
  { id: "C10d10", label: "+10% then -10%", arm: 0.1, dd: 0.1 },
  { id: "C15d5", label: "+15% then -5%", arm: 0.15, dd: 0.05 },
  { id: "C15d7", label: "+15% then -7%", arm: 0.15, dd: 0.07 },
  { id: "C15d10", label: "+15% then -10%", arm: 0.15, dd: 0.1 },
]

export function comboId(arm, dd) {
  return `p${Math.round(arm * 100)}-d${Math.round(dd * 100)}`
}

function round2(value) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 100) / 100
}

function pct(fraction) {
  if (fraction == null || !Number.isFinite(fraction)) return null
  return round2(fraction * 100)
}

function mean(values) {
  const xs = values.filter((value) => Number.isFinite(value))
  if (!xs.length) return null
  return xs.reduce((sum, value) => sum + value, 0) / xs.length
}

function share(flags) {
  if (!flags.length) return null
  return (flags.filter(Boolean).length / flags.length) * 100
}

function profitReached(close, entry, arm) {
  return entry > 0 && (close - entry) / entry + EPS >= arm
}

function pullbackReached(peak, close, dd) {
  return peak > close && (peak - close) / peak + EPS >= dd
}

/**
 * First pullback after the profit close has been seen.
 * Peak is the max close from the entry day through today.
 */
export function firstArmedPullback(closes, entryIdx, horizon, arm, dd) {
  const entry = closes[entryIdx]
  const end = Math.min(closes.length - 1, entryIdx + horizon)
  let peak = entry
  let armed = false
  for (let j = entryIdx + 1; j <= end; j++) {
    if (closes[j] > peak) peak = closes[j]
    if (!armed && profitReached(closes[j], entry, arm)) armed = true
    if (!armed) continue
    if (pullbackReached(peak, closes[j], dd)) {
      return {
        reached: true,
        pullbackIdx: j,
        peak,
        pullbackClose: closes[j],
        entry,
        end,
      }
    }
  }
  return { reached: armed, pullbackIdx: null, peak, pullbackClose: null, entry, end }
}

function closeAt(closes, index) {
  return index >= 0 && index < closes.length ? closes[index] : null
}

export function measurePullback(closes, entryIdx, horizon, arm, dd) {
  const found = firstArmedPullback(closes, entryIdx, horizon, arm, dd)
  if (!found.reached) {
    return { reached: false, pullback: false }
  }
  if (found.pullbackIdx == null) {
    return { reached: true, pullback: false }
  }
  const j = found.pullbackIdx
  const base = found.pullbackClose
  const forward = (days) => {
    const px = closeAt(closes, j + days)
    if (px == null || j + days > found.end) return null
    return (px - base) / base
  }
  let maxAfter = base
  let minAfter = base
  let reclaimIdx = null
  for (let k = j + 1; k <= found.end; k++) {
    if (closes[k] > maxAfter) maxAfter = closes[k]
    if (closes[k] < minAfter) minAfter = closes[k]
    if (reclaimIdx == null && closes[k] + EPS >= found.peak) reclaimIdx = k
  }
  const eligible20 = j + RECOVERY_WINDOW <= found.end
  let reclaimedWithin20 = null
  if (eligible20) {
    reclaimedWithin20 = false
    for (let k = j + 1; k <= j + RECOVERY_WINDOW; k++) {
      if (closes[k] + EPS >= found.peak) {
        reclaimedWithin20 = true
        break
      }
    }
  }
  return {
    reached: true,
    pullback: true,
    pullbackDays: j - entryIdx,
    returnAt: (base - found.entry) / found.entry,
    fwd5: forward(5),
    fwd10: forward(10),
    fwd20: forward(20),
    reclaimedBy60: reclaimIdx != null,
    daysToReclaim: reclaimIdx == null ? null : reclaimIdx - j,
    extraUp: base > 0 ? (maxAfter - base) / base : null,
    extraDown: base > 0 ? (base - minAfter) / base : null,
    eligible20,
    reclaimedWithin20,
  }
}

export function simulateArmedTrail(closes, entryIdx, horizon, arm, dd) {
  const found = firstArmedPullback(closes, entryIdx, horizon, arm, dd)
  const entry = closes[entryIdx]
  const end = found.end
  if (found.pullbackIdx == null) {
    const total = (closes[end] - entry) / entry
    return {
      completed: false,
      total,
      holdDays: horizon,
      missedUpside: 0,
      openWeight: 1,
    }
  }
  const price = closes[found.pullbackIdx]
  let maxAfter = price
  for (let k = found.pullbackIdx + 1; k <= end; k++) {
    if (closes[k] > maxAfter) maxAfter = closes[k]
  }
  return {
    completed: true,
    total: (price - entry) / entry,
    holdDays: found.pullbackIdx - entryIdx,
    missedUpside: Math.max(0, (maxAfter - price) / entry),
    openWeight: 0,
  }
}

export function summarizePullbacks(arm, dd, rows) {
  const reached = rows.filter((row) => row.reached)
  const pulls = reached.filter((row) => row.pullback)
  const eligible = pulls.filter((row) => row.eligible20)
  const recovered = eligible.filter((row) => row.reclaimedWithin20)
  const failed = eligible.filter((row) => row.reclaimedWithin20 === false)
  const reclaimed = pulls.filter((row) => row.reclaimedBy60)
  return {
    id: comboId(arm, dd),
    arm: Math.round(arm * 100),
    dd: Math.round(dd * 100),
    reached: reached.length,
    pullbacks: pulls.length,
    pullbackRate: round2(share(reached.map((row) => row.pullback))),
    avgReturnAt: pct(mean(pulls.map((row) => row.returnAt))),
    medianReturnAt: pct(median(pulls.map((row) => row.returnAt))),
    avgFwd5: pct(mean(pulls.map((row) => row.fwd5))),
    avgFwd10: pct(mean(pulls.map((row) => row.fwd10))),
    avgFwd20: pct(mean(pulls.map((row) => row.fwd20))),
    reclaimRate60: round2(share(pulls.map((row) => row.reclaimedBy60))),
    avgDaysToReclaim: round2(mean(reclaimed.map((row) => row.daysToReclaim))),
    avgExtraUp: pct(mean(pulls.map((row) => row.extraUp))),
    avgExtraDown: pct(mean(pulls.map((row) => row.extraDown))),
    eligible20: eligible.length,
    censored20: pulls.length - eligible.length,
    aRate: round2(share(eligible.map((row) => row.reclaimedWithin20 === true))),
    bRate: round2(share(eligible.map((row) => row.reclaimedWithin20 === false))),
    aCount: recovered.length,
    bCount: failed.length,
    aAvgRecoveryDays: round2(mean(recovered.map((row) => row.daysToReclaim))),
    aAvgExtraUp: pct(mean(recovered.map((row) => row.extraUp))),
    bAvgExtraDown: pct(mean(failed.map((row) => row.extraDown))),
  }
}

export function summarizeRule(spec, pairs) {
  const outcomes = pairs.map((pair) => pair.outcome)
  const events = pairs.map((pair) => pair.event)
  const total = outcomes.map((row) => row.total)
  const byEtf = DAILY_BOTTOM_BUY_ETFS.map((meta) => {
    const mine = pairs.filter((pair) => pair.event.etf === meta.symbol)
    const values = mine.map((pair) => pair.outcome.total)
    return {
      etf: meta.symbol,
      events: mine.length,
      completed: mine.filter((pair) => pair.outcome.completed).length,
      completionRate: round2(share(mine.map((pair) => pair.outcome.completed))),
      avgTotal: pct(mean(values)),
      medianTotal: pct(median(values)),
      winRate: round2(share(values.map((value) => value > 0))),
      avgMissedUpside: pct(mean(mine.map((pair) => pair.outcome.missedUpside))),
    }
  })
  const leaveOneOut = DAILY_BOTTOM_BUY_ETFS.map((meta) => {
    const kept = pairs.filter((pair) => pair.event.etf !== meta.symbol)
    return {
      excluded: meta.symbol,
      events: kept.length,
      avgTotal: pct(mean(kept.map((pair) => pair.outcome.total))),
    }
  })
  return {
    id: spec.id,
    label: spec.label,
    arm: spec.arm == null ? null : Math.round(spec.arm * 100),
    dd: spec.dd == null ? null : Math.round(spec.dd * 100),
    events: outcomes.length,
    completed: outcomes.filter((row) => row.completed).length,
    completionRate: round2(share(outcomes.map((row) => row.completed))),
    avgTotal: pct(mean(total)),
    medianTotal: pct(median(total)),
    winRate: round2(share(total.map((value) => value > 0))),
    maxLoss: pct(total.length ? Math.min(...total) : null),
    avgDays: round2(mean(outcomes.map((row) => row.holdDays))),
    medianDays: round2(median(outcomes.map((row) => row.holdDays))),
    p25: pct(percentile(total, 25)),
    p75: pct(percentile(total, 75)),
    medianMfe: pct(median(events.map((event) => event.mfe))),
    medianMae: pct(median(events.map((event) => event.mae))),
    avgMissedUpside: pct(mean(outcomes.map((row) => row.missedUpside))),
    medianMissedUpside: pct(median(outcomes.map((row) => row.missedUpside))),
    avgOpenWeight: round2(mean(outcomes.map((row) => row.openWeight)) * 100),
    etfs: byEtf,
    leaveOneOut,
  }
}

export function analyzeSymbolV3(symbol, rows, horizon = FORWARD_DAYS) {
  const built = buildSellEvents(rows, horizon)
  for (const event of built.events) event.etf = symbol
  const closes = rows.map((row) => row.close)
  const combos = {}
  for (const arm of PROFIT_ARMS) {
    for (const dd of PULLBACKS) {
      combos[comboId(arm, dd)] = built.events.map((event) =>
        measurePullback(closes, event.entryIdx, horizon, arm, dd),
      )
    }
  }
  const strategies = {}
  for (const spec of [...SELL_RULES, ...TRAIL_COMPARE]) {
    strategies[spec.id] = built.events.map((event) =>
      simulateArmedTrail(closes, event.entryIdx, horizon, spec.arm, spec.dd),
    )
  }
  const fixed = {}
  for (const id of ["tp10", "tp15", "tp20", "tp25"]) {
    const candidate = SELL_CANDIDATES.find((row) => row.id === id)
    fixed[id] = built.events.map((event) => {
      const sold = simulateSell(closes, event.entryIdx, horizon, candidate)
      return {
        completed: sold.completed,
        total: sold.realized,
        holdDays: sold.holdDays,
        missedUpside: sold.missedUpside,
        openWeight: sold.completed ? 0 : 1,
      }
    })
  }
  return {
    symbol,
    episodeCount: built.episodes.length,
    incomplete: built.incomplete,
    events: built.events,
    combos,
    strategies,
    fixed,
  }
}

function pairsFor(parts, bucket, id) {
  return parts.flatMap((part) =>
    part.events.map((event, index) => ({ event, outcome: part[bucket][id][index] })),
  )
}

export function poolV3(parts) {
  const events = parts.flatMap((part) => part.events)
  const pullbacks = []
  for (const arm of PROFIT_ARMS) {
    for (const dd of PULLBACKS) {
      const id = comboId(arm, dd)
      const rows = parts.flatMap((part) => part.combos[id])
      const summary = summarizePullbacks(arm, dd, rows)
      summary.etfs = DAILY_BOTTOM_BUY_ETFS.map((meta) => {
        const mine = []
        for (const part of parts) {
          if (part.symbol !== meta.symbol) continue
          mine.push(...part.combos[id])
        }
        return { etf: meta.symbol, ...summarizePullbacks(arm, dd, mine) }
      })
      pullbacks.push(summary)
    }
  }
  const strategies = SELL_RULES.map((spec) => summarizeRule(spec, pairsFor(parts, "strategies", spec.id)))
  const compareIds = [
    { id: "tp10", label: "+10% fixed", bucket: "fixed" },
    { id: "C10d5", label: "+10% then -5%", bucket: "strategies" },
    { id: "C10d7", label: "+10% then -7%", bucket: "strategies" },
    { id: "C10d10", label: "+10% then -10%", bucket: "strategies" },
    { id: "tp15", label: "+15% fixed", bucket: "fixed" },
    { id: "C15d5", label: "+15% then -5%", bucket: "strategies" },
    { id: "C15d7", label: "+15% then -7%", bucket: "strategies" },
    { id: "C15d10", label: "+15% then -10%", bucket: "strategies" },
  ]
  const fixedVsTrail = compareIds.map((spec) => {
    const summary = summarizeRule(spec, pairsFor(parts, spec.bucket, spec.id))
    summary.label = spec.label
    return summary
  })
  const dates = events.map((event) => event.signalDate).filter(Boolean).sort()
  return {
    events,
    pullbacks,
    strategies,
    fixedVsTrail,
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

export function formatPullbackTable(rows) {
  const header = [
    pad("Arm", 5),
    pad("DD", 4),
    pad("Reach", 6),
    pad("Pull", 6),
    pad("Rate", 7),
    pad("Ret", 7),
    pad("F5", 7),
    pad("F10", 7),
    pad("F20", 7),
    pad("A%", 7),
    pad("B%", 7),
    pad("RecD", 6),
    pad("UpA", 7),
    pad("DnB", 7),
  ].join(" ")
  const lines = [header]
  for (const row of rows) {
    lines.push(
      [
        pad(`+${row.arm}`, 5),
        pad(`-${row.dd}`, 4),
        pad(row.reached, 6),
        pad(row.pullbacks, 6),
        pad(row.pullbackRate, 7),
        pad(row.avgReturnAt, 7),
        pad(row.avgFwd5, 7),
        pad(row.avgFwd10, 7),
        pad(row.avgFwd20, 7),
        pad(row.aRate, 7),
        pad(row.bRate, 7),
        pad(row.aAvgRecoveryDays, 6),
        pad(row.aAvgExtraUp, 7),
        pad(row.bAvgExtraDown, 7),
      ].join(" "),
    )
  }
  return lines.join("\n")
}

export function formatRuleTable(rows) {
  const header = [
    pad("Rule", 20),
    pad("N", 5),
    pad("Done", 5),
    pad("Comp%", 7),
    pad("Avg", 7),
    pad("Med", 7),
    pad("Win%", 7),
    pad("MaxLoss", 8),
    pad("Days", 6),
    pad("Miss", 6),
    pad("Open%", 7),
  ].join(" ")
  const lines = [header]
  for (const row of rows) {
    lines.push(
      [
        pad(row.label, 20),
        pad(row.events, 5),
        pad(row.completed, 5),
        pad(row.completionRate, 7),
        pad(row.avgTotal, 7),
        pad(row.medianTotal, 7),
        pad(row.winRate, 7),
        pad(row.maxLoss, 8),
        pad(row.avgDays, 6),
        pad(row.avgMissedUpside, 6),
        pad(row.avgOpenWeight, 7),
      ].join(" "),
    )
  }
  return lines.join("\n")
}
