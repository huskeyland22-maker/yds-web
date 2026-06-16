/**
 * V7 — 시장 상태 이벤트 타임라인
 * 최근 4~5개 이벤트(진입/안정화/회복중) + 현재 상태 포함
 */

import {
  computeMarketPositionScore,
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
 *   score: number
 *   phase: '진입' | '안정화' | '회복중' | '약화'
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
 */
function rowPositionState(row) {
  const cnn = toNum(row?.fearGreed)
  const vix = toNum(row?.vix)
  const bofa = toNum(row?.bofa)
  const positionId = resolveMarketPositionId(cnn, vix, bofa)
  const score = computeMarketPositionScore(cnn, vix, bofa, positionId)
  return { positionId, score }
}

/**
 * @param {MarketPositionId} id
 * @param {number} delta
 * @returns {'안정화' | '회복중' | '약화'}
 */
function resolvePhase(id, delta) {
  if (Math.abs(delta) <= 2) return "안정화"
  const recoveryFavored = id === "panic" || id === "fear" || id === "adjustment"
  if (recoveryFavored) return delta >= 0 ? "회복중" : "약화"
  return delta >= 0 ? "약화" : "회복중"
}

/**
 * @param {object[]} historyRows
 * @param {number} [maxSteps]
 * @returns {MarketPositionTimelineStep[]}
 */
export function buildMarketPositionTimeline(historyRows, maxSteps = 5) {
  if (!Array.isArray(historyRows) || historyRows.length < 1) return []

  const sorted = [...historyRows]
    .filter((r) => r?.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))

  /** @type {MarketPositionTimelineStep[]} */
  const events = []
  let prevId = null
  let prevScore = null

  for (const row of sorted) {
    const date = String(row.date).slice(0, 10)
    const { positionId, score } = rowPositionState(row)
    const meta = stageMeta(positionId)

    if (prevId == null || positionId !== prevId) {
      events.push({
        date,
        dateShort: formatMmDd(date),
        positionId,
        label: meta.label,
        emoji: meta.emoji,
        score,
        phase: "진입",
        isCurrent: false,
      })
      prevId = positionId
      prevScore = score
      continue
    }

    if (prevScore == null) {
      prevScore = score
      continue
    }

    const delta = score - prevScore
    if (Math.abs(delta) >= 3) {
      events.push({
        date,
        dateShort: formatMmDd(date),
        positionId,
        label: meta.label,
        emoji: meta.emoji,
        score,
        phase: resolvePhase(positionId, delta),
        isCurrent: false,
      })
      prevScore = score
    }
  }

  if (!events.length) return []

  const lastEvent = events[events.length - 1]
  const lastRow = sorted[sorted.length - 1]
  const { positionId: currentId, score: currentScore } = rowPositionState(lastRow)

  if (lastEvent.date !== String(lastRow.date).slice(0, 10) || lastEvent.positionId !== currentId) {
    const meta = stageMeta(currentId)
    events.push({
      date: String(lastRow.date).slice(0, 10),
      dateShort: formatMmDd(String(lastRow.date)),
      positionId: currentId,
      label: meta.label,
      emoji: meta.emoji,
      score: currentScore,
      phase: "안정화",
      isCurrent: false,
    })
  }

  events[events.length - 1].isCurrent = true
  return events.slice(-Math.max(4, Math.min(5, maxSteps)))
}
