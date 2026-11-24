import { pearsonCorrelation } from "./math.js"

/**
 * Analyze DRBLACBS vs CORBLACBS overlapping samples.
 * High |corr| → do not dual-weight in CCI.
 *
 * @param {number[]} delinqAligned
 * @param {number[]} chargeoffAligned
 */
export function analyzeCorporateOverlap(delinqAligned, chargeoffAligned) {
  const corr = pearsonCorrelation(delinqAligned, chargeoffAligned)
  /** @type {'HIGH'|'MODERATE'|'LOW'|'UNKNOWN'} */
  let overlap = "UNKNOWN"
  if (corr == null) overlap = "UNKNOWN"
  else if (Math.abs(corr) >= 0.7) overlap = "HIGH"
  else if (Math.abs(corr) >= 0.4) overlap = "MODERATE"
  else overlap = "LOW"

  return {
    correlation: corr,
    overlap,
    recommendation:
      overlap === "HIGH" || overlap === "MODERATE"
        ? "use_DRBLACBS_only_in_default_cci"
        : overlap === "LOW"
          ? "optional_secondary_monitor_not_default_weight"
          : "insufficient_overlap_sample",
    defaultCciUses: "DRBLACBS",
    chargeoffSeries: "CORBLACBS",
  }
}
