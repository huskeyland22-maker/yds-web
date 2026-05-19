/** 차트 기간 프리셋 — 거래일 근사(캘린더 일) */

export const CHART_RANGES = [
  { id: "1M", label: "1M", days: 22 },
  { id: "6M", label: "6M", days: 126 },
  { id: "1Y", label: "1Y", days: 252 },
  { id: "5Y", label: "5Y", days: 1260 },
]

import { PANIC_HISTORY_DISABLE_RANGE_SLICE } from "./panicHistoryFetchDebug.js"

/** 패닉 히스토리 랩 — 1M / 3M / 6M / 1Y / ALL */
export const LAB_CHART_RANGES = [
  { id: "1M", label: "1M", days: 22 },
  { id: "3M", label: "3M", days: 66 },
  { id: "6M", label: "6M", days: 126 },
  { id: "1Y", label: "1Y", days: 252 },
  { id: "ALL", label: "ALL", days: null },
]

/**
 * @param {object[]} rows
 * @param {string} rangeId
 */
export function sliceHistoryByLabRange(rows, rangeId) {
  if (!Array.isArray(rows) || !rows.length) return []
  const sorted = [...rows].sort((a, b) => {
    const da = String(a.date ?? a.ts ?? "").slice(0, 10)
    const db = String(b.date ?? b.ts ?? "").slice(0, 10)
    return da.localeCompare(db)
  })
  if (PANIC_HISTORY_DISABLE_RANGE_SLICE) return sorted
  const preset = LAB_CHART_RANGES.find((r) => r.id === rangeId) ?? LAB_CHART_RANGES[2]
  if (preset.days == null || sorted.length <= preset.days) return sorted
  return sorted.slice(-preset.days)
}

/**
 * @param {object[]} rows
 * @param {string} rangeId
 */
export function sliceHistoryByRange(rows, rangeId) {
  if (!Array.isArray(rows) || !rows.length) return []
  const preset = CHART_RANGES.find((r) => r.id === rangeId) ?? CHART_RANGES[1]
  const sorted = [...rows].sort((a, b) => {
    const da = String(a.date ?? a.ts ?? "").slice(0, 10)
    const db = String(b.date ?? b.ts ?? "").slice(0, 10)
    return da.localeCompare(db)
  })
  if (sorted.length <= preset.days) return sorted
  return sorted.slice(-preset.days)
}

/**
 * 차트 구간별 실제 포인트 수 (더미 패딩 없음)
 * @param {object[]} rows
 * @param {string} rangeId
 * @param {"lab" | "desk"} [mode]
 */
export function chartRangeStats(rows, rangeId, mode = "lab") {
  const total = Array.isArray(rows) ? rows.length : 0
  const sliced =
    mode === "desk" ? sliceHistoryByRange(rows, rangeId) : sliceHistoryByLabRange(rows, rangeId)
  const presets = mode === "desk" ? CHART_RANGES : LAB_CHART_RANGES
  const preset = presets.find((r) => r.id === rangeId)
  return {
    rangeId,
    total,
    shown: sliced.length,
    presetDays: preset?.days ?? null,
    isFullHistory: preset?.days == null,
  }
}
