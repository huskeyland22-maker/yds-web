/**
 * YDS Phase 4-2 — YDS 준수율 엔진
 */

/** @typedef {{ usPct: number; krPct: number; cashPct: number }} AllocationTriple */

/**
 * @typedef {{
 *   gapPct: number
 *   compliancePct: number
 *   usCompliance: number
 *   krCompliance: number
 *   cashCompliance: number
 * }} ComplianceResult
 */

/** @typedef {'30' | '90' | 'all'} CompliancePeriodId */

/**
 * @param {AllocationTriple} recommended
 * @param {AllocationTriple} actual
 * @returns {ComplianceResult}
 */
export function computeCompliance(recommended, actual) {
  const usDiff = Math.abs(actual.usPct - recommended.usPct)
  const krDiff = Math.abs(actual.krPct - recommended.krPct)
  const cashDiff = Math.abs(actual.cashPct - recommended.cashPct)

  const gapPct = clampPct(Math.round((usDiff + krDiff + cashDiff) / 2))
  const compliancePct = clampPct(100 - gapPct)

  return {
    gapPct,
    compliancePct,
    usCompliance: clampPct(100 - usDiff),
    krCompliance: clampPct(100 - krDiff),
    cashCompliance: clampPct(100 - cashDiff),
  }
}

/** @param {number} n */
function clampPct(n) {
  return Math.max(0, Math.min(100, Math.round(n)))
}

/**
 * @param {import("./ydsActionLogEngine.js").YdsActionLogEntry[]} entries
 * @param {CompliancePeriodId} period
 */
export function computePeriodCompliance(entries, period = "30") {
  const filtered = filterEntriesByPeriod(entries, period)
  if (!filtered.length) {
    return {
      period,
      count: 0,
      overallCompliance: null,
      usCompliance: null,
      krCompliance: null,
      cashCompliance: null,
      avgGapPct: null,
    }
  }

  let sumOverall = 0
  let sumUs = 0
  let sumKr = 0
  let sumCash = 0
  let sumGap = 0

  for (const entry of filtered) {
    sumOverall += entry.compliancePct
    sumUs += entry.compliance.usCompliance
    sumKr += entry.compliance.krCompliance
    sumCash += entry.compliance.cashCompliance
    sumGap += entry.compliance.gapPct
  }

  const count = filtered.length
  return {
    period,
    count,
    overallCompliance: Math.round(sumOverall / count),
    usCompliance: Math.round(sumUs / count),
    krCompliance: Math.round(sumKr / count),
    cashCompliance: Math.round(sumCash / count),
    avgGapPct: Math.round(sumGap / count),
  }
}

/**
 * @param {import("./ydsActionLogEngine.js").YdsActionLogEntry[]} entries
 * @param {CompliancePeriodId | import("./ydsReturnEngine.js").ReturnPeriodId} period
 */
export function filterEntriesByPeriod(entries, period) {
  if (period === "all") return [...entries]
  const days = Number(period)
  if (!Number.isFinite(days)) return [...entries]

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return entries.filter((e) => {
    const ts = Date.parse(e.date) || e.createdAt
    return ts >= cutoff
  })
}
