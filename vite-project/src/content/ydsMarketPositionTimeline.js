/**
 * V7 — 시장 상태 타임라인 (CNN·VIX·BofA → 5구간 전환)
 */

import {
  MARKET_POSITION_STAGES,
  resolveMarketPositionId,
} from "./ydsMarketPositionEngine.js"

/** @typedef {import("./ydsMarketPositionEngine.js").MarketPositionId} MarketPositionId */

/**
 * @typedef {{
 *   date: string
 *   dateShort: string
 *   positionId: MarketPositionId
 *   label: string
 *   emoji: string
 *   isCurrent: boolean
 * }} MarketPositionTimelineStep
 */

/** @param {unknown} v */
function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** @param {string} dateStr */
function formatMmDd(dateStr) {
  const m = String(dateStr).slice(5, 7)
  const d = String(dateStr).slice(8, 10)
  if (!m || !d) return dateStr
  return `${m}/${d}`
}

/** @param {MarketPositionId} id */
function stageMeta(id) {
  const stage = MARKET_POSITION_STAGES.find((s) => s.id === id)
  return {
    label: stage?.label ?? id,
    emoji: stage?.emoji ?? "—",
    color: stage?.color ?? "#94a3b8",
  }
}

/**
 * @param {object} row
 * @returns {MarketPositionId}
 */
function positionFromRow(row) {
  return resolveMarketPositionId(toNum(row.fearGreed), toNum(row.vix), toNum(row.bofa))
}

/**
 * @param {object[]} historyRows
 * @param {number} [maxSteps]
 * @returns {MarketPositionTimelineStep[]}
 */
export function buildMarketPositionTimeline(historyRows, maxSteps = 4) {
  if (!Array.isArray(historyRows) || historyRows.length < 1) return []

  const sorted = [...historyRows]
    .filter((r) => r?.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))

  /** @type {MarketPositionTimelineStep[]} */
  const transitions = []
  /** @type {MarketPositionId | null} */
  let prevId = null

  for (const row of sorted) {
    const positionId = positionFromRow(row)
    if (positionId === prevId) continue

    const meta = stageMeta(positionId)
    transitions.push({
      date: String(row.date).slice(0, 10),
      dateShort: formatMmDd(String(row.date)),
      positionId,
      label: meta.label,
      emoji: meta.emoji,
      isCurrent: false,
    })
    prevId = positionId
  }

  if (!transitions.length) return []

  transitions[transitions.length - 1].isCurrent = true
  return transitions.slice(-maxSteps)
}
