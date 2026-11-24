import { QUALITY, CCI_POLICY } from "./config.js"
import { daysBetween } from "./math.js"

/**
 * @param {object} args
 * @param {string} args.asOfDate
 * @param {string} args.lastObservationDate
 * @param {'daily'|'monthly'|'quarterly'} args.frequency
 * @param {number} args.maxStalePeriods
 * @param {string | null} [args.releaseDate]
 */
export function assessFreshness(args) {
  const { asOfDate, lastObservationDate, frequency, maxStalePeriods, releaseDate } =
    args
  if (!lastObservationDate) {
    return { status: QUALITY.MISSING, periodsElapsed: null, reason: "no_observation" }
  }

  let periodsElapsed = null
  if (frequency === "daily") {
    periodsElapsed = daysBetween(lastObservationDate, asOfDate)
  } else if (frequency === "monthly") {
    const d = daysBetween(lastObservationDate, asOfDate)
    periodsElapsed = d == null ? null : Math.floor(d / 30)
  } else if (frequency === "quarterly") {
    const d = daysBetween(lastObservationDate, asOfDate)
    periodsElapsed = d == null ? null : Math.floor(d / 90)
  }

  if (periodsElapsed == null) {
    return { status: QUALITY.INVALID, periodsElapsed: null, reason: "bad_dates" }
  }

  if (periodsElapsed > maxStalePeriods) {
    return {
      status: QUALITY.STALE,
      periodsElapsed,
      lastObservationDate,
      releaseDate: releaseDate ?? null,
      reason: "exceeds_max_stale_periods",
    }
  }

  // Delayed: release known and lag from observation to release is large relative to freq
  if (releaseDate && lastObservationDate) {
    const pubLag = daysBetween(lastObservationDate, releaseDate)
    const expected =
      frequency === "daily" ? 5 : frequency === "monthly" ? 45 : 120
    if (pubLag != null && pubLag > expected) {
      return {
        status: QUALITY.DELAYED,
        periodsElapsed,
        publicationLagDays: pubLag,
        lastObservationDate,
        releaseDate,
        reason: "publication_lag",
      }
    }
  }

  return {
    status: QUALITY.VALID,
    periodsElapsed,
    lastObservationDate,
    releaseDate: releaseDate ?? null,
    reason: "ok",
  }
}

/**
 * @param {Array<{ id: string, weightNominal: number, score: number | null, quality: string, licenseRestricted?: boolean }>} parts
 */
export function computeCoverageAndConfidence(parts) {
  const totalWeight = parts.reduce((s, p) => s + p.weightNominal, 0)
  let availableWeight = 0
  let missingWeight = 0
  const missing = []
  const stale = []
  const licenseRestricted = []
  let availableCount = 0

  for (const p of parts) {
    if (p.quality === QUALITY.LICENSE_RESTRICTED || p.licenseRestricted) {
      licenseRestricted.push(p.id)
    }
    if (p.quality === QUALITY.STALE) stale.push(p.id)
    if (p.score == null || !Number.isFinite(p.score)) {
      missingWeight += p.weightNominal
      missing.push(p.id)
      continue
    }
    if (
      p.quality === QUALITY.MISSING ||
      p.quality === QUALITY.INVALID ||
      p.quality === QUALITY.VINTAGE_UNAVAILABLE
    ) {
      missingWeight += p.weightNominal
      missing.push(p.id)
      continue
    }
    availableWeight += p.weightNominal
    availableCount += 1
  }

  const coverage = totalWeight > 0 ? availableWeight / totalWeight : 0
  const missingShare = totalWeight > 0 ? missingWeight / totalWeight : 1

  /** @type {'HIGH'|'MEDIUM'|'LOW'|'HOLD'} */
  let confidence = "HIGH"
  let hold = false
  if (coverage < CCI_POLICY.coverageHoldBelow) {
    confidence = "HOLD"
    hold = true
  } else if (missingShare > CCI_POLICY.missingWeightWarnAbove) {
    confidence = "LOW"
  } else if (stale.length > 0 || missingShare > 0.1) {
    confidence = "MEDIUM"
  }

  return {
    coverage,
    availableWeight,
    missingWeight,
    missingShare,
    availableCount,
    missingIndicators: missing,
    staleIndicators: stale,
    licenseRestrictedIndicators: licenseRestricted,
    confidence,
    hold,
    policy: {
      coverageHoldBelow: CCI_POLICY.coverageHoldBelow,
      missingWeightWarnAbove: CCI_POLICY.missingWeightWarnAbove,
      note: "hypothesis thresholds — validate via backtest",
    },
  }
}
