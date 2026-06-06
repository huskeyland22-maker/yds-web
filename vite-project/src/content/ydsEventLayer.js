/**
 * Event Layer — CNN·BofA 구간 이탈 이벤트 (표시 전용 · 점수·장기 상태 무관)
 * @see docs/YDS_DUAL_CYCLE_FRAMEWORK.md
 */

import { mergeLayerHistory, rowDate, rowsWithinDays, toNum } from "./ydsLayerHistory.js"

/** @typedef {"none"|"exit"|"strongExit"} EventLevel */

/**
 * @typedef {{
 *   id: string
 *   metric: "cnn"|"bofa"
 *   level: EventLevel
 *   headline: string
 *   explainLines: string[]
 *   peak: number
 *   current: number
 *   entryMin: number
 *   exitMax: number
 * }} ZoneExitEvent
 */

/**
 * @typedef {{
 *   hasEvents: boolean
 *   level: EventLevel
 *   events: ZoneExitEvent[]
 *   headline: string
 * }} EventLayerView
 */

export const EVENT_RULES = {
  cnn: {
    field: "fearGreed",
    metric: "cnn",
    lookbackDays: 21,
    exitMax: 60,
    tiers: [
      { level: "strongExit", entryMin: 80, zoneLabel: "강한 과열(80+)" },
      { level: "exit", entryMin: 70, zoneLabel: "과열권(70+)" },
    ],
  },
  bofa: {
    field: "bofa",
    metric: "bofa",
    lookbackDays: 28,
    exitMax: 6,
    tiers: [
      { level: "strongExit", entryMin: 8, zoneLabel: "강한 과열(8+)" },
      { level: "exit", entryMin: 7, zoneLabel: "과열권(7+)" },
    ],
  },
}

/** @param {EventLevel} a @param {EventLevel} b */
function maxEventLevel(a, b) {
  const rank = { none: 0, exit: 1, strongExit: 2 }
  return rank[a] >= rank[b] ? a : b
}

/**
 * @param {"cnn"|"bofa"} metric
 * @param {typeof EVENT_RULES.cnn} rule
 * @param {number} peak
 * @param {number} current
 * @param {{ level: EventLevel; entryMin: number; zoneLabel: string }} tier
 */
function buildEventCopy(metric, rule, peak, current, tier) {
  const isStrong = tier.level === "strongExit"
  if (metric === "cnn") {
    return {
      headline: isStrong
        ? "CNN Fear & Greed 강한 과열(80+)이 해소되었습니다."
        : "CNN Fear & Greed가 과열권(70+)에서 이탈했습니다.",
      explainLines: isStrong
        ? [
            `최근 peak ${Math.round(peak)} → 현재 ${Math.round(current)} (≤${rule.exitMax}).`,
            "강한 탐욕 구간 이후 심리가 빠르게 냉각되는 구간입니다.",
            "단기적으로 위험자산 선호 심리가 약화될 수 있습니다.",
          ]
        : [
            `최근 peak ${Math.round(peak)} → 현재 ${Math.round(current)} (≤${rule.exitMax}).`,
            "단기적으로 위험자산 선호 심리가 약화되는 구간입니다.",
          ],
    }
  }
  return {
    headline: isStrong
      ? "BofA Bull & Bear 강한 과열(8+)이 해소되었습니다."
      : "BofA Bull & Bear가 과열권(7+)에서 이탈했습니다.",
    explainLines: isStrong
      ? [
          `최근 peak ${peak.toFixed(1)} → 현재 ${current.toFixed(1)} (≤${rule.exitMax}).`,
          "극단 낙관 구간 이후 심리 냉각이 진행 중입니다.",
        ]
      : [
          `최근 peak ${peak.toFixed(1)} → 현재 ${current.toFixed(1)} (≤${rule.exitMax}).`,
          "과열권 이탈 — 수익 관리·비중 점검을 검토하세요.",
        ],
  }
}

/**
 * @param {object[]} sorted
 * @param {typeof EVENT_RULES.cnn} rule
 */
function detectZoneExit(sorted, rule) {
  const latest = sorted[sorted.length - 1]
  const current = toNum(latest?.[rule.field])
  if (current == null || current > rule.exitMax) return null

  const windowRows = rowsWithinDays(sorted, rule.lookbackDays)
  let peak = null
  for (const row of windowRows) {
    const v = toNum(row[rule.field])
    if (v != null) peak = peak == null ? v : Math.max(peak, v)
  }
  if (peak == null) return null

  const tiers = [...rule.tiers].sort((a, b) => b.entryMin - a.entryMin)
  for (const tier of tiers) {
    if (peak >= tier.entryMin) {
      const copy = buildEventCopy(rule.metric, rule, peak, current, tier)
      return {
        id: `${rule.metric}-${tier.level}`,
        metric: rule.metric,
        level: tier.level,
        headline: copy.headline,
        explainLines: copy.explainLines,
        peak,
        current,
        entryMin: tier.entryMin,
        exitMax: rule.exitMax,
      }
    }
  }
  return null
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

  /** @type {ZoneExitEvent[]} */
  const events = []
  for (const rule of [EVENT_RULES.cnn, EVENT_RULES.bofa]) {
    const ev = detectZoneExit(merged, rule)
    if (ev) events.push(ev)
  }

  events.sort((a, b) => {
    const rank = { strongExit: 2, exit: 1, none: 0 }
    return rank[b.level] - rank[a.level]
  })

  let level = /** @type {EventLevel} */ ("none")
  for (const ev of events) {
    level = maxEventLevel(level, ev.level)
  }

  const headline = events.length
    ? events.map((e) => e.headline).join(" · ")
    : ""

  return {
    hasEvents: events.length > 0,
    level,
    events,
    headline,
  }
}
