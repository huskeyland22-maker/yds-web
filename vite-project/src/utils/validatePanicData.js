/**
 * STEP 12: 패닉 API 페이로드 신뢰도 검증 (MVP 범위: VIX·공포탐욕 구간).
 * @param {unknown} data
 * @returns {boolean}
 */
export function validatePanicData(data) {
  if (!data) return false

  const vix = Number(data.vix)
  const fearGreed = Number(data.fearGreed)

  if (!Number.isFinite(vix) || vix < 0 || vix > 100) return false
  if (!Number.isFinite(fearGreed) || fearGreed < 0 || fearGreed > 100) return false

  return true
}
