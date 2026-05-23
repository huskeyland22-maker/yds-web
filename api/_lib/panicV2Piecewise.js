/** @param {number} n @param {number} lo @param {number} hi */
export function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

/**
 * @param {number | null | undefined} value
 * @param {[number, number][]} knots
 */
export function piecewiseNorm(value, knots) {
  if (value == null || value === "" || !Number.isFinite(Number(value))) return null
  const v = Number(value)
  if (!knots.length) return null
  if (v <= knots[0][0]) return knots[0][1]
  const last = knots[knots.length - 1]
  if (v >= last[0]) return last[1]
  for (let i = 0; i < knots.length - 1; i++) {
    const [x0, y0] = knots[i]
    const [x1, y1] = knots[i + 1]
    if (v >= x0 && v <= x1) {
      const t = x1 === x0 ? 0 : (v - x0) / (x1 - x0)
      return clamp(y0 + t * (y1 - y0), 0, 100)
    }
  }
  return last[1]
}
