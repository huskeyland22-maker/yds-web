import { panicMetricNumber } from "./panicMetricValue.js"

/**
 * 패닉 페이로드 검증 (flat 숫자 또는 { value } 모두 허용).
 * @param {unknown} data
 * @returns {boolean}
 */
export function validatePanicData(data) {
  if (!data || typeof data !== "object") return false

  const vix = panicMetricNumber(data.vix)
  const fearGreed = panicMetricNumber(data.fearGreed)

  if (!Number.isFinite(vix) || vix < 5 || vix > 120) return false
  if (!Number.isFinite(fearGreed) || fearGreed < 0 || fearGreed > 100) return false

  /** Render 등 구형 API는 일부 필드만 보낼 수 있음 — 값이 있을 때만 구간 검증 */
  const optional = [
    ["putCall", 0.2, 3],
    ["bofa", 0.1, 15],
    ["highYield", 0.1, 25],
  ]
  for (const [key, lo, hi] of optional) {
    if (!(key in data) || data[key] === null || data[key] === undefined) continue
    const n = panicMetricNumber(data[key])
    if (!Number.isFinite(n) || n < lo || n > hi) return false
  }

  return true
}
