/**
 * 실전 V2 — 매매 이벤트 기록 (히스토리 row 기반)
 */
import { formatChartAxisMd } from "../utils/chartDateFormat.js"
import { pickMetricValue } from "../utils/panicMarketActionEngine.js"
import { sortHistoryRowsAsc } from "../utils/panicHistoryDesk.js"
import { computeTacticalTiming } from "../utils/panicTacticalTimingEngine.js"

/** @typedef {"buyCandidate" | "maintainInterest" | "addWeight" | "watch" | "riskCaution"} TacticalEventId */

/** @type {Record<TacticalEventId, string>} */
export const TACTICAL_EVENT_LABELS = {
  buyCandidate: "매수후보",
  maintainInterest: "관심유지",
  addWeight: "비중확대",
  watch: "관망",
  riskCaution: "리스크주의",
}

/**
 * @param {object} row
 * @returns {string}
 */
export function buildTacticalEventReason(row) {
  /** @type {string[]} */
  const parts = []
  const vix = pickMetricValue(row, "vix")
  const pc = pickMetricValue(row, "putCall")
  const fg = pickMetricValue(row, "fearGreed")
  const move = pickMetricValue(row, "move")
  const vvix = pickMetricValue(row, "vvix")

  if (vix != null && vix <= 18) parts.push("VIX 안정")
  else if (vix != null && vix >= 26) parts.push("VIX 확대")
  if (pc != null && pc <= 0.55) parts.push("P/C 과열")
  else if (pc != null && pc >= 0.88) parts.push("P/C 헤지")
  if (fg != null && fg <= 30) parts.push("CNN 공포")
  else if (fg != null && fg >= 72) parts.push("CNN 과열")
  if (move != null && move >= 110) parts.push("MOVE 상승")
  else if (move != null && move < 95) parts.push("MOVE 안정")
  if (vvix != null && vvix >= 120) parts.push("VVIX 부담")

  if (!parts.length) return "시장 종합"
  return parts.slice(0, 2).join(" + ")
}

/**
 * @param {number} interestScore
 * @param {number | null} prevInterest
 */
export function resolveTacticalTradeEventId(interestScore, prevInterest) {
  const s = Number(interestScore)
  const prev = prevInterest != null ? Number(prevInterest) : null
  const delta = prev != null && Number.isFinite(prev) ? s - prev : 0

  if (s >= 78) return delta >= 8 ? "buyCandidate" : "maintainInterest"
  if (s >= 62) return delta >= 6 ? "addWeight" : "maintainInterest"
  if (s >= 42) return "watch"
  return "riskCaution"
}

/**
 * @typedef {{
 *   date: string
 *   axisLabel: string
 *   eventId: TacticalEventId
 *   eventLabel: string
 *   reason: string
 *   interestScore: number
 * }} TacticalTradeEventEntry
 */

/**
 * @param {object[]} history
 * @param {{ maxEntries?: number; changeOnly?: boolean }} [opts]
 * @returns {TacticalTradeEventEntry[]}
 */
export function buildTacticalTradeEventLog(history, opts = {}) {
  const { maxEntries = 12, changeOnly = true } = opts
  const rows = sortHistoryRowsAsc(history)
  /** @type {TacticalTradeEventEntry[]} */
  const out = []
  let prevEventId = null
  let prevInterest = null

  for (const row of rows) {
    const signal = computeTacticalTiming(row)
    if (signal?.score == null) continue
    const interestScore = signal.score
    const eventId = resolveTacticalTradeEventId(interestScore, prevInterest)
    const eventLabel = TACTICAL_EVENT_LABELS[eventId]

    if (!changeOnly || eventId !== prevEventId) {
      const date = String(row.date ?? "").slice(0, 10)
      out.push({
        date,
        axisLabel: formatChartAxisMd(date),
        eventId,
        eventLabel,
        reason: buildTacticalEventReason(row),
        interestScore,
      })
      prevEventId = eventId
    }
    prevInterest = interestScore
  }

  return out.slice(-maxEntries)
}

/**
 * @param {TacticalTradeEventEntry[]} events
 * @param {object[]} chartData
 */
export function attachTradeEventsToChartData(events, chartData) {
  const byDate = Object.fromEntries(events.map((e) => [e.date, e]))
  return chartData.map((pt) => {
    const ev = byDate[pt.date]
    if (!ev) return pt
    return {
      ...pt,
      tradeEventId: ev.eventId,
      tradeEventLabel: ev.eventLabel,
      tradeEventReason: ev.reason,
      inflectionLabel: `${ev.eventLabel}`,
      inflectionColor:
        ev.eventId === "buyCandidate" || ev.eventId === "addWeight"
          ? "#34d399"
          : ev.eventId === "maintainInterest"
            ? "#22d3ee"
            : ev.eventId === "watch"
              ? "#94a3b8"
              : "#f87171",
    }
  })
}
