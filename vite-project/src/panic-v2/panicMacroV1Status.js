/**
 * 거시 V1 — 패닉지수 구간 (높을수록 장기 분할·패닉 매수 기회)
 */

/** @typedef {"overheated" | "neutral" | "interest" | "dca" | "panicBuy"} MacroV1StatusId */

/**
 * @typedef {{
 *   id: MacroV1StatusId
 *   label: string
 *   emoji: string
 *   min: number
 *   max: number
 *   color: string
 * }} MacroV1Status
 */

/** @type {MacroV1Status[]} */
export const MACRO_V1_STATUS_BANDS = [
  { id: "overheated", label: "과열구간", emoji: "🔵", min: 0, max: 19, color: "#3b82f6" },
  { id: "neutral", label: "중립구간", emoji: "🟢", min: 20, max: 39, color: "#22c55e" },
  { id: "interest", label: "관심구간", emoji: "🟡", min: 40, max: 59, color: "#eab308" },
  { id: "dca", label: "분할매수", emoji: "🟠", min: 60, max: 79, color: "#f97316" },
  { id: "panicBuy", label: "패닉매수", emoji: "🔴", min: 80, max: 100, color: "#ef4444" },
]

/** @param {number | null | undefined} score @returns {MacroV1Status | null} */
export function resolveMacroV1Status(score) {
  if (score == null || !Number.isFinite(score)) return null
  const s = Math.max(0, Math.min(100, Math.round(Number(score))))
  if (s <= 19) return MACRO_V1_STATUS_BANDS[0]
  if (s <= 39) return MACRO_V1_STATUS_BANDS[1]
  if (s <= 59) return MACRO_V1_STATUS_BANDS[2]
  if (s <= 79) return MACRO_V1_STATUS_BANDS[3]
  return MACRO_V1_STATUS_BANDS[4]
}

/** @returns {{ y1: number; y2: number; label: string; color: string; area: boolean }[]} */
export function macroV1ZoneBands() {
  return [
    { y1: 0, y2: 20, label: "", color: "#3b82f6", area: true },
    { y1: 20, y2: 40, label: "", color: "#22c55e", area: true },
    { y1: 40, y2: 60, label: "", color: "#eab308", area: true },
    { y1: 60, y2: 80, label: "", color: "#f97316", area: true },
    { y1: 80, y2: 100, label: "", color: "#ef4444", area: true },
  ]
}
