/** @param {number} x @param {number} lo @param {number} hi */
export function clamp(x, lo, hi) {
  if (!Number.isFinite(x)) return null
  return Math.min(hi, Math.max(lo, x))
}

/** @param {number[]} values sorted ascending */
export function percentileRank(sortedAsc, value) {
  if (!Array.isArray(sortedAsc) || sortedAsc.length < 1) return null
  if (!Number.isFinite(value)) return null
  let below = 0
  let equal = 0
  for (const v of sortedAsc) {
    if (v < value) below += 1
    else if (v === value) equal += 1
  }
  // Mid-rank percentile in [0,1]
  return (below + 0.5 * equal) / sortedAsc.length
}

/** @param {number[]} values */
export function sortedCopy(values) {
  return values.filter((v) => Number.isFinite(v)).slice().sort((a, b) => a - b)
}

/**
 * Convert distribution percentile (0–1) to risk score 0–100 given direction.
 * @param {number | null} pct
 * @param {'higher_is_risk'|'lower_is_risk'} direction
 */
export function percentileToRiskScore(pct, direction) {
  if (pct == null || !Number.isFinite(pct)) return null
  const p = clamp(pct, 0, 1)
  if (p == null) return null
  const riskFrac = direction === "higher_is_risk" ? p : 1 - p
  return Math.round(riskFrac * 100)
}

/** @param {string} isoDate */
export function parseIsoDate(isoDate) {
  const s = String(isoDate ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const t = Date.parse(`${s}T00:00:00Z`)
  return Number.isFinite(t) ? t : null
}

/** @param {string} a @param {string} b */
export function daysBetween(a, b) {
  const ta = parseIsoDate(a)
  const tb = parseIsoDate(b)
  if (ta == null || tb == null) return null
  return Math.round((tb - ta) / 86400000)
}

/**
 * Pearson correlation; returns null if insufficient variance/length.
 * @param {number[]} xs
 * @param {number[]} ys
 */
export function pearsonCorrelation(xs, ys) {
  const n = Math.min(xs.length, ys.length)
  if (n < 8) return null
  let sx = 0
  let sy = 0
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(xs[i]) || !Number.isFinite(ys[i])) return null
    sx += xs[i]
    sy += ys[i]
  }
  const mx = sx / n
  const my = sy / n
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i++) {
    const ax = xs[i] - mx
    const ay = ys[i] - my
    num += ax * ay
    dx += ax * ax
    dy += ay * ay
  }
  if (dx <= 0 || dy <= 0) return null
  return num / Math.sqrt(dx * dy)
}
