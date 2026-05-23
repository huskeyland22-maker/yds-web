/** 패닉 V1/V2 공통 상태 구간 — 서버·클라이언트 동일 */

export const PANIC_V2_STATUS_BANDS = [
  { id: "stable", label: "안정", min: 0, max: 20 },
  { id: "observe", label: "관찰", min: 20, max: 40 },
  { id: "caution", label: "경계", min: 40, max: 60 },
  { id: "fear", label: "공포", min: 60, max: 80 },
  { id: "panic", label: "패닉", min: 80, max: 100 },
]

/** @param {number | null | undefined} score */
export function resolvePanicV2Status(score) {
  if (score == null || !Number.isFinite(score)) return null
  const s = Math.max(0, Math.min(100, score))
  if (s < 20) return PANIC_V2_STATUS_BANDS[0]
  if (s < 40) return PANIC_V2_STATUS_BANDS[1]
  if (s < 60) return PANIC_V2_STATUS_BANDS[2]
  if (s < 80) return PANIC_V2_STATUS_BANDS[3]
  return PANIC_V2_STATUS_BANDS[4]
}
