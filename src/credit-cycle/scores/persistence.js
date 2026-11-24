import { percentileRank, sortedCopy, clamp } from "../math.js"

/**
 * Persistence: fraction of lookback window spent above risk threshold percentile
 * of the expanding history (risk-increasing side).
 *
 * @param {number[]} historyValues
 * @param {{
 *   riskDirection: 'higher_is_risk'|'lower_is_risk',
 *   lookback: number,
 *   riskThresholdPercentile: number,
 *   minHistory: number,
 * }} opts
 */
export function computePersistenceScore(historyValues, opts) {
  const lookback = Math.max(2, opts.lookback | 0)
  const minHistory = opts.minHistory ?? lookback
  if (!Array.isArray(historyValues) || historyValues.length < minHistory) {
    return { score: null, elevatedShare: null, reason: "insufficient_history" }
  }

  const window = historyValues.slice(-lookback)
  const sortedFull = sortedCopy(historyValues)
  const thrPct = clamp((opts.riskThresholdPercentile ?? 70) / 100, 0, 1)
  if (thrPct == null) {
    return { score: null, elevatedShare: null, reason: "bad_threshold" }
  }

  // Threshold value at thrPct of expanding distribution
  const idx = Math.min(
    sortedFull.length - 1,
    Math.max(0, Math.floor(thrPct * (sortedFull.length - 1))),
  )
  const thresholdValue = sortedFull[idx]

  let elevated = 0
  for (const v of window) {
    if (!Number.isFinite(v)) continue
    const risky =
      opts.riskDirection === "higher_is_risk"
        ? v >= thresholdValue
        : v <= thresholdValue
    if (risky) elevated += 1
  }
  const elevatedShare = elevated / window.length
  const score = Math.round(elevatedShare * 100)
  return { score, elevatedShare, thresholdValue, reason: "ok" }
}
