/**
 * 미국 국채 금리 유효성 — 0.00 오표시 방지 (FRED 실패·파싱 오류)
 */

/** @param {unknown} value */
export function isValidUsTreasuryYield(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0.05 && n < 25
}

/** @param {unknown} value @returns {number | null} */
export function normalizeUsTreasuryYield(value) {
  return isValidUsTreasuryYield(value) ? Number(value) : null
}

/** @param {number[]} values */
export function filterValidTreasuryYields(values) {
  if (!Array.isArray(values)) return []
  return values.map(Number).filter((n) => isValidUsTreasuryYield(n))
}
