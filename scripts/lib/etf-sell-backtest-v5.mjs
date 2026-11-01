/**
 * ETF sell backtest v5 (research only).
 *
 * Same 3/4 episodes and the same v4 peak/pullback definition.
 * At the first pullback close T0, an immediate sale is compared with holding
 * the later closes that actually exist. Missing T+N bars are left out.
 * No sell rule is selected.
 */

import {
  DAILY_BOTTOM_BUY_ETFS,
  FORWARD_DAYS,
  buildSellEvents,
  median,
} from "./etf-sell-backtest.mjs"
import {
  RECOVERY_WINDOW,
  firstArmedPullback,
  measurePullback,
  summarizePullbacks,
} from "./etf-sell-backtest-v3.mjs"

export {
  DAILY_BOTTOM_BUY_ETFS,
  FORWARD_DAYS,
  RECOVERY_WINDOW,
  buildSellEvents,
  firstArmedPullback,
  measurePullback,
  summarizePullbacks,
}

const LOSS_EPS = 1e-12
export const SMALL_SAMPLE = 10
export const HOLD_OFFSETS = [5, 10, 20, 40]

export const PROFIT_EVENTS = [
  { id: "p10-d5", label: "+10 → -5", arm: 0.1, dd: 0.05 },
  { id: "p10-d7", label: "+10 → -7", arm: 0.1, dd: 0.07 },
  { id: "p10-d10", label: "+10 → -10", arm: 0.1, dd: 0.1 },
  { id: "p15-d5", label: "+15 → -5", arm: 0.15, dd: 0.05 },
  { id: "p15-d7", label: "+15 → -7", arm: 0.15, dd: 0.07 },
  { id: "p15-d10", label: "+15 → -10", arm: 0.15, dd: 0.1 },
  { id: "p20-d5", label: "+20 → -5", arm: 0.2, dd: 0.05 },
  { id: "p20-d7", label: "+20 → -7", arm: 0.2, dd: 0.07 },
  { id: "p20-d10", label: "+20 → -10", arm: 0.2, dd: 0.1 },
]

export const ETF_FOCUS_IDS = ["p10-d5", "p15-d5", "p20-d5", "p10-d10", "p15-d10"]

export const LOSS_EVENTS = [
  { id: "loss5", label: "미도달 -5", dd: 0.05 },
  { id: "loss7", label: "미도달 -7", dd: 0.07 },
  { id: "loss10", label: "미도달 -10", dd: 0.1 },
  { id: "loss15", label: "미도달 -15", dd: 0.15 },
  { id: "loss20", label: "미도달 -20", dd: 0.2 },
]

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

function lossReached(close, entry, dd) {
  return entry > 0 && (entry - close) / entry + LOSS_EPS >= dd
}

function quoteAt(closes, index, end, entry, t0Price) {
  if (index > end || index < 0 || index >= closes.length) return null
  const price = closes[index]
  return {
    vsEntry: (price - entry) / entry,
    vsT0: t0Price > 0 ? (price - t0Price) / t0Price : null,
  }
}

function extremesAfter(closes, t0, end, t0Price) {
  if (t0 >= end) return { extraUp: null, extraDown: null, hasAfter: false }
  let maxPrice = closes[t0 + 1]
  let minPrice = closes[t0 + 1]
  for (let k = t0 + 1; k <= end; k++) {
    if (closes[k] > maxPrice) maxPrice = closes[k]
    if (closes[k] < minPrice) minPrice = closes[k]
  }
  return {
    hasAfter: true,
    extraUp: t0Price > 0 ? (maxPrice - t0Price) / t0Price : null,
    extraDown: t0Price > 0 ? (t0Price - minPrice) / t0Price : null,
  }
}

function horizonPoints(closes, t0, end, entry, t0Price) {
  const points = {}
  for (const offset of HOLD_OFFSETS) {
    points[`t${offset}`] = quoteAt(closes, t0 + offset, end, entry, t0Price)
  }
  points.end = quoteAt(closes, end, end, entry, t0Price)
  return points
}

export function measureHoldVsSell(closes, entryIdx, horizon, arm, dd) {
  const base = measurePullback(closes, entryIdx, horizon, arm, dd)
  if (!base.pullback) return { ...base, event: false }
  const found = firstArmedPullback(closes, entryIdx, horizon, arm, dd)
  const t0 = found.pullbackIdx
  const entry = found.entry
  const t0Price = found.pullbackClose
  const after = extremesAfter(closes, t0, found.end, t0Price)
  return {
    ...base,
    event: true,
    t0,
    entry,
    t0Price,
    sellVsEntry: base.returnAt,
    horizons: horizonPoints(closes, t0, found.end, entry, t0Price),
    maxRise: after.extraUp,
    maxDrop: after.extraDown,
    hasAfter: after.hasAfter,
  }
}

export function firstLossIndex(closes, entryIdx, horizon, dd) {
  const entry = closes[entryIdx]
  const end = Math.min(closes.length - 1, entryIdx + horizon)
  for (let j = entryIdx + 1; j <= end; j++) {
    if (lossReached(closes[j], entry, dd)) return j
  }
  return null
}

export function measureLossHold(closes, entryIdx, horizon, dd) {
  const t0 = firstLossIndex(closes, entryIdx, horizon, dd)
  if (t0 == null) return { event: false }
  const entry = closes[entryIdx]
  const end = Math.min(closes.length - 1, entryIdx + horizon)
  const t0Price = closes[t0]
  const after = extremesAfter(closes, t0, end, t0Price)
  return {
    event: true,
    t0,
    entry,
    t0Price,
    sellVsEntry: (t0Price - entry) / entry,
    horizons: horizonPoints(closes, t0, end, entry, t0Price),
    maxRise: after.extraUp,
    maxDrop: after.extraDown,
    hasAfter: after.hasAfter,
  }
}

export function classifyAdvantage(avgEdge, medianEdge, beatRate) {
  if (avgEdge == null || medianEdge == null || beatRate == null) return "표본 없음"
  if (avgEdge > 0 && medianEdge > 0 && beatRate >= 50) return "계속 보유 우위"
  if (avgEdge < 0 && medianEdge < 0 && beatRate < 50) return "매도 우위 후보"
  return "혼합"
}

function pointSummary(rows, key) {
  const present = rows.filter((row) => row.horizons?.[key])
  const holdEntry = present.map((row) => row.horizons[key].vsEntry)
  const holdT0 = present.map((row) => row.horizons[key].vsT0)
  const sell = present.map((row) => row.sellVsEntry)
  const avgEdge = mean(present.map((row) => row.horizons[key].vsEntry - row.sellVsEntry))
  const medianEdge = median(holdEntry) == null || median(sell) == null ? null : median(holdEntry) - median(sell)
  const beatRate = share(present.map((row) => row.horizons[key].vsT0 > 0))
  return {
    n: present.length,
    avgVsEntry: pct(mean(holdEntry)),
    medianVsEntry: pct(median(holdEntry)),
    avgVsT0: pct(mean(holdT0)),
    medianVsT0: pct(median(holdT0)),
    winRate: round2(share(holdEntry.map((value) => value > 0))),
    pairedSellAvg: pct(mean(sell)),
    pairedSellMedian: pct(median(sell)),
    avgEdge: pct(avgEdge),
    medianEdge: pct(medianEdge),
    beatRate: round2(beatRate),
    label: classifyAdvantage(avgEdge, medianEdge, beatRate),
    sampleNote: present.length < SMALL_SAMPLE ? "표본 부족" : null,
  }
}

function splitSummary(rows) {
  const t20 = pointSummary(rows, "t20")
  const t40 = pointSummary(rows, "t40")
  const end = pointSummary(rows, "end")
  return {
    n: rows.length,
    t20n: t20.n,
    t20AvgVsEntry: t20.avgVsEntry,
    t20MedianVsEntry: t20.medianVsEntry,
    t20AvgVsT0: t20.avgVsT0,
    t40n: t40.n,
    t40AvgVsEntry: t40.avgVsEntry,
    t40AvgVsT0: t40.avgVsT0,
    endN: end.n,
    endAvgVsEntry: end.avgVsEntry,
    endAvgVsT0: end.avgVsT0,
  }
}

export function summarizeDecisions(spec, rows) {
  const events = rows.filter((row) => row.event)
  const sells = events.map((row) => row.sellVsEntry)
  const after = events.filter((row) => row.hasAfter)
  const eligible = events.filter((row) => row.eligible20)
  const recovered = eligible.filter((row) => row.reclaimedWithin20 === true)
  const failed = eligible.filter((row) => row.reclaimedWithin20 === false)
  const pullback = spec.arm == null ? null : summarizePullbacks(spec.arm, spec.dd, rows)
  const t20 = pointSummary(events, "t20")
  return {
    id: spec.id,
    label: spec.label,
    arm: spec.arm == null ? null : Math.round(spec.arm * 100),
    dd: spec.dd == null ? Math.round(spec.dd * 100) : Math.round(spec.dd * 100),
    n: events.length,
    sellAvg: pct(mean(sells)),
    sellMedian: pct(median(sells)),
    t5: pointSummary(events, "t5"),
    t10: pointSummary(events, "t10"),
    t20,
    t40: pointSummary(events, "t40"),
    end: pointSummary(events, "end"),
    reclaimRate: pullback ? pullback.aRate : null,
    reclaimEligible: pullback ? pullback.eligible20 : null,
    reclaimDays: pullback ? pullback.aAvgRecoveryDays : null,
    reclaimNote: pullback && pullback.eligible20 < SMALL_SAMPLE ? "표본 부족" : null,
    extraN: after.length,
    extraUpAvg: pct(mean(after.map((row) => row.maxRise))),
    extraUpMedian: pct(median(after.map((row) => row.maxRise))),
    extraDownAvg: pct(mean(after.map((row) => row.maxDrop))),
    extraDownMedian: pct(median(after.map((row) => row.maxDrop))),
    reclaimed20: splitSummary(recovered),
    failed20: splitSummary(failed),
    advantage: {
      n: t20.n,
      avgEdge: t20.avgEdge,
      medianEdge: t20.medianEdge,
      beatRate: t20.beatRate,
      label: t20.sampleNote ? "표본 부족" : t20.label,
      rawLabel: t20.label,
      sampleNote: t20.sampleNote,
    },
  }
}

export function summarizeEtf(spec, rows) {
  const summary = summarizeDecisions(spec, rows)
  const thin = summary.n < SMALL_SAMPLE || summary.t20.n < SMALL_SAMPLE
  return {
    n: summary.n,
    sellAvg: summary.sellAvg,
    t20n: summary.t20.n,
    t20Avg: summary.t20.avgVsEntry,
    t20Win: summary.t20.winRate,
    t20PairedSellAvg: summary.t20.pairedSellAvg,
    reclaimRate: summary.reclaimRate,
    reclaimEligible: summary.reclaimEligible,
    sampleNote: thin ? "표본 부족" : null,
    reclaimNote: summary.reclaimNote,
  }
}

export function analyzeSymbolV5(symbol, rows, horizon = FORWARD_DAYS) {
  const built = buildSellEvents(rows, horizon)
  for (const event of built.events) event.etf = symbol
  const closes = rows.map((row) => row.close)
  const profit = {}
  for (const spec of PROFIT_EVENTS) {
    profit[spec.id] = built.events.map((event) => ({
      ...measureHoldVsSell(closes, event.entryIdx, horizon, spec.arm, spec.dd),
      etf: symbol,
    }))
  }
  const losses = {}
  const missed = built.events.filter((event) => !event.hit10)
  for (const spec of LOSS_EVENTS) {
    losses[spec.id] = missed.map((event) => ({
      ...measureLossHold(closes, event.entryIdx, horizon, spec.dd),
      etf: symbol,
    }))
  }
  return {
    symbol,
    episodeCount: built.episodes.length,
    incomplete: built.incomplete,
    events: built.events,
    profit,
    losses,
    missed: missed.length,
  }
}

export function poolV5(parts) {
  const events = parts.flatMap((part) => part.events)
  const profit = PROFIT_EVENTS.map((spec) => {
    const rows = parts.flatMap((part) => part.profit[spec.id])
    const summary = summarizeDecisions(spec, rows)
    summary.etfs = DAILY_BOTTOM_BUY_ETFS.map((meta) => ({
      etf: meta.symbol,
      ...summarizeEtf(spec, rows.filter((row) => row.etf === meta.symbol)),
    }))
    return summary
  })
  const losses = LOSS_EVENTS.map((spec) =>
    summarizeDecisions(spec, parts.flatMap((part) => part.losses[spec.id])),
  )
  const dates = events.map((event) => event.signalDate).filter(Boolean).sort()
  return {
    events,
    missed: events.filter((event) => !event.hit10).length,
    profit,
    losses,
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

export function formatDecisionTable(rows) {
  const header = [
    pad("Event", 12),
    pad("N", 4),
    pad("Sell", 7),
    pad("Med", 7),
    pad("T5", 7),
    pad("n5", 4),
    pad("T10", 7),
    pad("T20", 7),
    pad("n20", 4),
    pad("T40", 7),
    pad("n40", 4),
    pad("End", 7),
    pad("W20", 6),
    pad("W40", 6),
    pad("A%", 6),
    pad("Rec", 5),
    pad("Up", 7),
    pad("Dn", 7),
    pad("Class", 14),
  ].join(" ")
  const lines = [header]
  for (const row of rows) {
    lines.push(
      [
        pad(row.label, 12),
        pad(row.n, 4),
        pad(row.sellAvg, 7),
        pad(row.sellMedian, 7),
        pad(row.t5.avgVsEntry, 7),
        pad(row.t5.n, 4),
        pad(row.t10.avgVsEntry, 7),
        pad(row.t20.avgVsEntry, 7),
        pad(row.t20.n, 4),
        pad(row.t40.avgVsEntry, 7),
        pad(row.t40.n, 4),
        pad(row.end.avgVsEntry, 7),
        pad(row.t20.winRate, 6),
        pad(row.t40.winRate, 6),
        pad(row.reclaimRate, 6),
        pad(row.reclaimDays, 5),
        pad(row.extraUpAvg, 7),
        pad(row.extraDownAvg, 7),
        pad(row.advantage.label, 14),
      ].join(" "),
    )
  }
  return lines.join("\n")
}

export function formatEdgeTable(rows) {
  const header = [
    pad("Event", 12),
    pad("n20", 4),
    pad("Sell20", 7),
    pad("Hold20", 7),
    pad("Avg+", 7),
    pad("Med+", 7),
    pad("Beat", 6),
    pad("Class", 14),
  ].join(" ")
  const lines = [header]
  for (const row of rows) {
    lines.push(
      [
        pad(row.label, 12),
        pad(row.t20.n, 4),
        pad(row.t20.pairedSellAvg, 7),
        pad(row.t20.avgVsEntry, 7),
        pad(row.t20.avgEdge, 7),
        pad(row.t20.medianEdge, 7),
        pad(row.t20.beatRate, 6),
        pad(row.advantage.label, 14),
      ].join(" "),
    )
  }
  return lines.join("\n")
}
