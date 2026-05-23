/**
 * 패닉 V2 실전 엔진 상태 구간 (0~100)
 */

/** @typedef {"stable" | "observe" | "dip" | "fear" | "buy" | "extreme"} PanicV2StatusId */

/**
 * @typedef {{
 *   id: PanicV2StatusId
 *   label: string
 *   min: number
 *   max: number
 *   toneClass: string
 * }} PanicV2Status
 */

/** @type {PanicV2Status[]} */
export const PANIC_V2_STATUS_BANDS = [
  { id: "stable", label: "안정", min: 0, max: 20, toneClass: "panic-v2-status--stable" },
  { id: "observe", label: "관찰", min: 20, max: 35, toneClass: "panic-v2-status--transition" },
  { id: "dip", label: "눌림", min: 35, max: 50, toneClass: "panic-v2-status--caution" },
  { id: "fear", label: "공포", min: 50, max: 70, toneClass: "panic-v2-status--fear" },
  { id: "buy", label: "실전 매수 후보", min: 70, max: 85, toneClass: "panic-v2-status--panic" },
  { id: "extreme", label: "극단 공포", min: 85, max: 100, toneClass: "panic-v2-status--panic" },
]

/**
 * @param {number | null | undefined} score
 * @returns {PanicV2Status | null}
 */
export function resolvePanicV2Status(score) {
  if (score == null || !Number.isFinite(score)) return null
  const s = Math.max(0, Math.min(100, score))
  if (s < 20) return PANIC_V2_STATUS_BANDS[0]
  if (s < 35) return PANIC_V2_STATUS_BANDS[1]
  if (s < 50) return PANIC_V2_STATUS_BANDS[2]
  if (s < 70) return PANIC_V2_STATUS_BANDS[3]
  if (s < 85) return PANIC_V2_STATUS_BANDS[4]
  return PANIC_V2_STATUS_BANDS[5]
}
