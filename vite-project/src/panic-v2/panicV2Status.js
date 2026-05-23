/**
 * 패닉지수 V2 상태 구간 (0~100)
 */

/** @typedef {"stable" | "transition" | "caution" | "fear" | "panic"} PanicV2StatusId */

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
  { id: "transition", label: "전환", min: 20, max: 40, toneClass: "panic-v2-status--transition" },
  { id: "caution", label: "경계", min: 40, max: 60, toneClass: "panic-v2-status--caution" },
  { id: "fear", label: "공포", min: 60, max: 80, toneClass: "panic-v2-status--fear" },
  { id: "panic", label: "패닉", min: 80, max: 100, toneClass: "panic-v2-status--panic" },
]

/**
 * @param {number | null | undefined} score
 * @returns {PanicV2Status | null}
 */
export function resolvePanicV2Status(score) {
  if (score == null || !Number.isFinite(score)) return null
  const s = Math.max(0, Math.min(100, score))
  if (s < 20) return PANIC_V2_STATUS_BANDS[0]
  if (s < 40) return PANIC_V2_STATUS_BANDS[1]
  if (s < 60) return PANIC_V2_STATUS_BANDS[2]
  if (s < 80) return PANIC_V2_STATUS_BANDS[3]
  return PANIC_V2_STATUS_BANDS[4]
}
