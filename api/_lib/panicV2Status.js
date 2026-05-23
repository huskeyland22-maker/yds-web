/** 패닉 V2 실전 엔진 상태 구간 — 서버·클라이언트 동일 */

export const PANIC_V2_STATUS_BANDS = [
  { id: "stable", label: "안정", min: 0, max: 20 },
  { id: "observe", label: "관찰", min: 20, max: 35 },
  { id: "dip", label: "눌림", min: 35, max: 50 },
  { id: "fear", label: "공포", min: 50, max: 70 },
  { id: "buy", label: "실전 매수 후보", min: 70, max: 85 },
  { id: "extreme", label: "극단 공포", min: 85, max: 100 },
]

/** @param {number | null | undefined} score */
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
