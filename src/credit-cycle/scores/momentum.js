import { clamp } from "../math.js"

/**
 * Momentum from period changes on the same-frequency series.
 * Maps worsening (risk-increasing) changes toward 100.
 *
 * @param {number[]} historyValues
 * @param {{
 *   riskDirection: 'higher_is_risk'|'lower_is_risk',
 *   shortPeriods: number,
 *   longPeriods: number,
 * }} opts
 */
export function computeMomentumScore(historyValues, opts) {
  const shortP = Math.max(1, opts.shortPeriods | 0)
  const longP = Math.max(shortP, opts.longPeriods | 0)
  if (!Array.isArray(historyValues) || historyValues.length < longP + 1) {
    return { score: null, shortDelta: null, longDelta: null, reason: "insufficient_history" }
  }
  const cur = historyValues[historyValues.length - 1]
  const shortPrev = historyValues[historyValues.length - 1 - shortP]
  const longPrev = historyValues[historyValues.length - 1 - longP]
  if (![cur, shortPrev, longPrev].every(Number.isFinite)) {
    return { score: null, shortDelta: null, longDelta: null, reason: "missing_points" }
  }

  const shortDelta = cur - shortPrev
  const longDelta = cur - longPrev

  // Normalize deltas relative to absolute level scale (avoid div0)
  const scale = Math.max(Math.abs(cur), Math.abs(longPrev), 1e-6)
  let shortZ = shortDelta / scale
  let longZ = longDelta / scale
  if (opts.riskDirection === "lower_is_risk") {
    shortZ = -shortZ
    longZ = -longZ
  }

  // Map signed worsening into 0–100 via tanh-like squash
  const blend = 0.55 * shortZ + 0.45 * longZ
  const mapped = 50 + 50 * Math.tanh(blend * 3)
  const score = clamp(mapped, 0, 100)
  return {
    score: score == null ? null : Math.round(score),
    shortDelta,
    longDelta,
    reason: "ok",
  }
}
