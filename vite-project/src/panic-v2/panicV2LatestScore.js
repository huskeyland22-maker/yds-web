/**
 * 패닉 V2 — 상단 카드·차트 공통 최신 점수 (history 단일 소스)
 */
import { formatChartAxisMd } from "../utils/chartDateFormat.js"
import { sortHistoryRowsAsc } from "../utils/panicHistoryDesk.js"

/** @param {object} r */
export function panicV2ValueFromRow(r) {
  const raw =
    r.panic_v2 ??
    r.panicV2 ??
    r.panicV2Score ??
    r.panic_index_v2 ??
    (r.panicScore != null && r.panicScore !== "" && Number(r.panicScore) !== 0 ? r.panicScore : null) ??
    null
  if (raw == null || raw === "") return null
  const value = Number(raw)
  return Number.isNaN(value) ? null : value
}

/** @param {object[]} rows */
export function buildPanicV2ChartData(rows) {
  return sortHistoryRowsAsc(rows)
    .map((r) => {
      const date = String(r.date ?? r.ts ?? "").slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
      const value = panicV2ValueFromRow(r)
      return {
        date,
        axisLabel: formatChartAxisMd(date),
        value,
        panicV2: value,
      }
    })
    .filter(Boolean)
}

/**
 * 히스토리 최신 유효 panic_v2 (카드·차트 헤더 동일)
 * @param {object[]} history
 * @returns {number | null}
 */
export function resolveLatestPanicV2HistoryScore(history) {
  const chartData = buildPanicV2ChartData(history)
  const latestValid = [...chartData].reverse().find((x) => x.value != null)
  return latestValid?.value ?? null
}
