import { percentileRank, percentileToRiskScore, sortedCopy } from "../math.js"

/**
 * Expanding-window level score at the last point of `historyValues`
 * (history must already exclude future observations).
 *
 * @param {number[]} historyValues inclusive of current
 * @param {{ riskDirection: 'higher_is_risk'|'lower_is_risk', minHistory: number }} opts
 * @returns {{ score: number | null, percentile: number | null, reason: string }}
 */
export function computeLevelScore(historyValues, opts) {
  const minHistory = opts.minHistory ?? 20
  if (!Array.isArray(historyValues) || historyValues.length < minHistory) {
    return {
      score: null,
      percentile: null,
      reason: "insufficient_history",
    }
  }
  const current = historyValues[historyValues.length - 1]
  if (!Number.isFinite(current)) {
    return { score: null, percentile: null, reason: "missing_current" }
  }
  const sorted = sortedCopy(historyValues)
  const pct = percentileRank(sorted, current)
  const score = percentileToRiskScore(pct, opts.riskDirection)
  return {
    score,
    percentile: pct,
    reason: score == null ? "percentile_failed" : "ok",
  }
}
