/**
 * Event Layer V1.5 — 최근 시장 변화 (표시 전용 · 점수·가중치 무관)
 * State · Overheat · Momentum · Event · Action
 */

import { computeCnnDeltas, resolveActiveCnnEventSpec } from "./ydsCnnEventEngine.js"
import { mergeLayerHistory, rowDate, rowsWithinDays, toNum } from "./ydsLayerHistory.js"
import { MOMENTUM_RULES, resolveMomentumLayer } from "./ydsMomentumLayer.js"

/** @typedef {"none"|"exit"|"entry"|"momentum"} EventLevel */

/**
 * @typedef {{
 *   id: string
 *   kind: "exit"|"entry"|"momentum"
 *   metric: "cnn"|"bofa"
 *   level: EventLevel
 *   emoji: string
 *   title: string
 *   summary: string
 *   peak?: number
 *   current?: number
 *   prior?: number
 * }} MarketEvent
 */

/**
 * @typedef {{
 *   hasEvents: boolean
 *   level: EventLevel
 *   events: MarketEvent[]
 *   headline: string
 * }} EventLayerView
 */

export const EVENT_RULES = {
  cnn: {
    field: "fearGreed",
    metric: "cnn",
    lookbackDays: 21,
    exitPeakMin: 70,
    exitCurrentMax: 60,
    entryPriorMax: 60,
    entryCurrentMin: 70,
  },
  bofa: {
    field: "bofa",
    metric: "bofa",
    lookbackDays: 28,
    exitPeakMin: 7,
    exitCurrentMax: 6,
    entryPriorMax: 6,
    entryCurrentMin: 7,
  },
}

/** @param {EventLevel} a @param {EventLevel} b */
function maxEventLevel(a, b) {
  const rank = { none: 0, entry: 1, momentum: 2, exit: 3 }
  return rank[a] >= rank[b] ? a : b
}

/**
 * @param {object[]} sorted
 * @param {typeof EVENT_RULES.cnn} rule
 */
function detectZoneExit(sorted, rule, copy) {
  const latest = sorted[sorted.length - 1]
  const current = toNum(latest?.[rule.field])
  if (current == null || current >= rule.exitCurrentMax) return null

  const windowRows = rowsWithinDays(sorted, rule.lookbackDays)
  let peak = null
  for (const row of windowRows) {
    const v = toNum(row[rule.field])
    if (v != null) peak = peak == null ? v : Math.max(peak, v)
  }
  if (peak == null || peak < rule.exitPeakMin) return null

  return {
    id: `${rule.metric}-exit`,
    kind: "exit",
    metric: rule.metric,
    level: "exit",
    emoji: copy.emoji,
    title: copy.title,
    summary: copy.summary,
    peak,
    current,
  }
}

/**
 * @param {object[]} sorted
 * @param {typeof EVENT_RULES.cnn} rule
 */
function detectZoneEntry(sorted, rule, copy) {
  const latest = sorted[sorted.length - 1]
  const current = toNum(latest?.[rule.field])
  if (current == null || current < rule.entryCurrentMin) return null

  const windowRows = rowsWithinDays(sorted, rule.lookbackDays)
  let priorMin = null
  for (const row of windowRows) {
    const v = toNum(row[rule.field])
    if (v != null) priorMin = priorMin == null ? v : Math.min(priorMin, v)
  }
  if (priorMin == null || priorMin > rule.entryPriorMax) return null

  return {
    id: `${rule.metric}-entry`,
    kind: "entry",
    metric: rule.metric,
    level: "entry",
    emoji: copy.emoji,
    title: copy.title,
    summary: copy.summary,
    prior: priorMin,
    current,
  }
}

/**
 * @param {object | null | undefined} panicData
 * @param {object[]} historyRows
 */
function detectMomentumEvents(panicData, historyRows) {
  const mom = resolveMomentumLayer(panicData, historyRows)
  /** @type {MarketEvent[]} */
  const events = []

  const { delta3d, delta1d } = computeCnnDeltas(panicData, historyRows)
  const cnnSpec = resolveActiveCnnEventSpec(delta3d, delta1d)
  if (cnnSpec) {
    events.push({
      id: cnnSpec.id,
      kind: "momentum",
      metric: "cnn",
      level: cnnSpec.severity === "high" ? "exit" : "momentum",
      emoji: cnnSpec.emoji,
      title: cnnSpec.title,
      summary: "",
    })
  }

  if (mom.bofaDelta2w != null && mom.bofaDelta2w <= MOMENTUM_RULES.bofa.warningDelta) {
    events.push({
      id: "momentum-bofa-weak",
      kind: "momentum",
      metric: "bofa",
      level: "momentum",
      emoji: "🟠",
      title: "Bull & Bear 악화",
      summary: "",
    })
  }

  return events
}

/** @param {MarketEvent[]} events */
function sortEvents(events) {
  const kindRank = { exit: 3, momentum: 2, entry: 1 }
  return [...events].sort((a, b) => kindRank[b.level] - kindRank[a.level])
}

/**
 * @param {object | null | undefined} panicData
 * @param {object[]} [historyRows]
 */
export function resolveEventLayer(panicData, historyRows = []) {
  const asOf = rowDate(panicData) ?? rowDate(historyRows[historyRows.length - 1])
  const merged = mergeLayerHistory(historyRows, asOf, panicData)

  if (!merged.length) {
    return /** @type {EventLayerView} */ ({
      hasEvents: false,
      level: "none",
      events: [],
      headline: "",
    })
  }

  /** @type {MarketEvent[]} */
  const events = []

  const cnnExit = detectZoneExit(merged, EVENT_RULES.cnn, {
    emoji: "🟠",
    title: "CNN 과열권 이탈",
    summary: "낙관 심리가 약화되고 있습니다.",
  })
  const cnnEntry = detectZoneEntry(merged, EVENT_RULES.cnn, {
    emoji: "🟡",
    title: "CNN 과열권 진입",
    summary: "",
  })
  if (cnnExit) events.push(cnnExit)
  else if (cnnEntry) events.push(cnnEntry)

  const bofaExit = detectZoneExit(merged, EVENT_RULES.bofa, {
    emoji: "🟠",
    title: "BofA 과열권 이탈",
    summary: "과열 신호가 완화되고 있습니다.",
  })
  const bofaEntry = detectZoneEntry(merged, EVENT_RULES.bofa, {
    emoji: "🟡",
    title: "BofA 과열권 진입",
    summary: "",
  })
  if (bofaExit) events.push(bofaExit)
  else if (bofaEntry) events.push(bofaEntry)

  events.push(...detectMomentumEvents(panicData, historyRows))

  const sorted = sortEvents(events)

  let level = /** @type {EventLevel} */ ("none")
  for (const ev of sorted) {
    level = maxEventLevel(level, ev.level)
  }

  const headline = sorted.length ? sorted.map((e) => e.title).join(" · ") : ""

  return {
    hasEvents: sorted.length > 0,
    level,
    events: sorted,
    headline,
  }
}
