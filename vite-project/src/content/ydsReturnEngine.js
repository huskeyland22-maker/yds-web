/**
 * YDS Phase 4-3 — 실제 수익률 엔진
 */

import { filterEntriesByPeriod } from "./ydsComplianceEngine.js"

/** @typedef {'30' | '90' | '180' | '365'} ReturnPeriodId */

/**
 * @param {number | null | undefined} startAsset
 * @param {number | null | undefined} endAsset
 * @returns {number | null}
 */
export function computeReturnPct(startAsset, endAsset) {
  const start = Number(startAsset)
  const end = Number(endAsset)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0) return null
  return Math.round(((end - start) / start) * 1000) / 10
}

/**
 * @param {import("./ydsActionLogEngine.js").YdsActionLogEntry[]} entries
 * @param {ReturnPeriodId} period
 */
export function computeReturnStats(entries, period = "90") {
  const filtered = filterEntriesByPeriod(entries, period).filter(
    (e) => e.returnPct != null && Number.isFinite(e.returnPct),
  )

  if (!filtered.length) {
    return {
      period,
      count: 0,
      avgReturnPct: null,
      maxReturnPct: null,
      minReturnPct: null,
    }
  }

  const values = filtered.map((e) => e.returnPct)
  const sum = values.reduce((a, b) => a + b, 0)

  return {
    period,
    count: filtered.length,
    avgReturnPct: Math.round((sum / values.length) * 10) / 10,
    maxReturnPct: Math.max(...values),
    minReturnPct: Math.min(...values),
  }
}
