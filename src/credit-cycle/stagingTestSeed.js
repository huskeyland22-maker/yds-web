/** Known Phase 10B Staging plumbing seed — never treat as live market data. */
export const STAGING_TEST_SEED_AS_OF = "1900-01-01"
export const STAGING_TEST_SEED_CALC_VERSION = "phase10b-staging-test-seed"

/**
 * @param {object | null | undefined} point
 */
export function isStagingTestSeedPoint(point) {
  if (!point || typeof point !== "object") return false
  const asOf = String(point.asOf || point.as_of_date || "")
  const calc = String(point.calculationVersion || point.calculation_version || "")
  const hold = String(point.holdReason || point.hold_reason || "")
  const conf = String(point.confidence || point.confidence_status || "")
  if (asOf === STAGING_TEST_SEED_AS_OF) return true
  if (calc === STAGING_TEST_SEED_CALC_VERSION) return true
  if (hold.includes("PHASE10B_STAGING_TEST_SEED")) return true
  if (conf === "TEST_SEED_ONLY" || conf.includes("TEST_SEED")) return true
  return false
}
