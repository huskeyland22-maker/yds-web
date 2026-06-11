/**
 * 전환 신호 — 이벤트 발생 전후 점수 변화 (panic_history 기준)
 */

import { sortHistoryRowsAsc } from "../utils/panicHistoryDesk.js"
import {
  marketStateScoreForRow,
  panicIntensityScoreForRow,
} from "./ydsMarketTrendSeries.js"

const PANIC_EVENT_RE = /^panic-/
const MARKET_EVENT_RE =
  /^(position-|overheat-|cnn-entry|cnn-exit|bofa-entry|bofa-exit|momentum-cnn-crash|momentum-cnn-sharp|momentum-bofa-weak|vix-expansion)/

/**
 * @param {object[]} historyRows
 * @param {{ date?: string; type?: string }} event
 * @returns {{ label: string; from: number; to: number; text: string } | null}
 */
export function resolveTimelineScoreDelta(historyRows, event) {
  if (!event?.date) return null

  const sorted = sortHistoryRowsAsc(historyRows)
  const idx = sorted.findIndex((row) => String(row.date ?? "").slice(0, 10) === event.date)
  if (idx <= 0) return null

  const prev = sorted[idx - 1]
  const curr = sorted[idx]
  const type = String(event.type ?? "")

  const usePanic = PANIC_EVENT_RE.test(type)
  const useMarket = !usePanic && (MARKET_EVENT_RE.test(type) || type.startsWith("momentum-"))

  if (usePanic) {
    const from = panicIntensityScoreForRow(prev)
    const to = panicIntensityScoreForRow(curr)
    if (from == null || to == null) return null
    return {
      label: "패닉 강도",
      from,
      to,
      text: `패닉 강도 ${from} → ${to}`,
    }
  }

  if (useMarket) {
    const from = marketStateScoreForRow(prev)
    const to = marketStateScoreForRow(curr)
    if (from == null || to == null) return null
    return {
      label: "시장 상태",
      from,
      to,
      text: `시장 상태 ${from} → ${to}`,
    }
  }

  return null
}

/**
 * @param {object[]} historyRows
 * @param {object[]} events
 */
export function enrichTimelineEventsWithScoreDeltas(historyRows, events) {
  return (events ?? []).map((event) => ({
    ...event,
    scoreDelta: resolveTimelineScoreDelta(historyRows, event),
  }))
}
