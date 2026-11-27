/**
 * CORE Risk bridge — loads parallel core_risk snapshot for UI.
 * Does not import research/. Does not mutate legacy CCI DTO.
 */

const CORE_SNAPSHOT_URL = "/credit-cycle/core-r-core-snapshot.json"

function buildUnavailableCoreRiskDto(reason) {
  return {
    namespace: "core_risk",
    schema_version: "core_risk-0.1.0",
    feed_status: "NO_VERIFIED_PRODUCT_FEED",
    as_of: null,
    observation_period: null,
    retrieval_date: null,
    R_core: null,
    r_status: "INSUFFICIENT_DATA",
    domain_scores: { supply: null, quantity: null, realized: null },
    domain_detail: null,
    feature_scores_by_id: {},
    window_years_candidate: 10,
    window_status: "WINDOW_NOT_CALIBRATED",
    weight_scheme: "EQUAL_DOMAIN_CANDIDATE",
    weight_status: "WEIGHT_NOT_CALIBRATED",
    risk_grade: null,
    grade_status: "GRADE_NOT_CALIBRATED",
    pit_class: "NON_STRICT_PIT",
    confidence: {
      pit_class: "NON_STRICT_PIT",
      release_date_known: false,
      coverage_domains: 0,
      risk_coupled: false,
      r_status: "INSUFFICIENT_DATA",
    },
    conflict_flags: [],
    confirmation_flag: false,
    unavailable_features: ["ALL"],
    calibration_status: "NOT_CALIBRATED",
    reason,
    notes: [
      "Product Board CORE feed not verified for live scoring.",
      "Research tip scores (e.g. 2026-06-30 R_core=60) are not shown as current live scores.",
      "WINDOW_NOT_CALIBRATED · WEIGHT_NOT_CALIBRATED · GRADE_NOT_CALIBRATED · NON_STRICT_PIT",
      "Confidence ≠ Risk. Conflict is non-additive.",
    ],
    independent_of: [
      "legacy_cci",
      "panic",
      "soft_state",
      "section_25_overall_score",
    ],
    coverage: {
      status: "INSUFFICIENT_DATA",
      domains: { supply: false, quantity: false, realized: false },
    },
  }
}

/**
 * Normalize snapshot JSON into UI model.
 * - VERIFIED_PRODUCT_FEED + numeric R_core → live display
 * - research_reference_only never copied into live R_core
 */
export function adaptCoreRiskSnapshot(json) {
  if (!json || typeof json !== "object") {
    return {
      core_risk: buildUnavailableCoreRiskDto("SNAPSHOT_MISSING"),
      loadStatus: "MISSING",
      error: "snapshot_missing",
      research_reference_only: null,
    }
  }

  const cr = json.core_risk
  if (!cr || typeof cr !== "object") {
    return {
      core_risk: buildUnavailableCoreRiskDto("SNAPSHOT_MALFORMED"),
      loadStatus: "MALFORMED",
      error: "snapshot_malformed",
      research_reference_only: json.research_reference_only || null,
    }
  }

  const researchRef = json.research_reference_only || null
  const live = {
    ...cr,
    namespace: "core_risk",
    risk_grade: null,
    grade_status: cr.grade_status || "GRADE_NOT_CALIBRATED",
    window_status: cr.window_status || "WINDOW_NOT_CALIBRATED",
    weight_status: cr.weight_status || "WEIGHT_NOT_CALIBRATED",
    pit_class: cr.pit_class || "NON_STRICT_PIT",
  }

  const verified =
    (json.feed_status === "VERIFIED_PRODUCT_FEED" ||
      live.feed_status === "VERIFIED_PRODUCT_FEED") &&
    live.R_core != null &&
    Number.isFinite(Number(live.R_core)) &&
    live.r_status === "OK"

  if (!verified) {
    // Do not promote research tip into live
    live.R_core = null
    live.feed_status = live.feed_status || "NO_VERIFIED_PRODUCT_FEED"
    if (live.r_status === "OK") live.r_status = "INSUFFICIENT_DATA"
    if (
      researchRef?.example_historical_tip?.R_core != null &&
      live.feed_status === "NO_VERIFIED_PRODUCT_FEED"
    ) {
      live.R_core = null
    }
    return {
      core_risk: live.feed_status === "NO_VERIFIED_PRODUCT_FEED"
        ? { ...buildUnavailableCoreRiskDto(live.reason || "UNVERIFIED"), ...live, R_core: null }
        : { ...live, R_core: null },
      loadStatus:
        live.feed_status === "NO_VERIFIED_PRODUCT_FEED"
          ? "NO_VERIFIED_PRODUCT_FEED"
          : "INSUFFICIENT_DATA",
      error: null,
      research_reference_only: researchRef,
    }
  }

  return {
    core_risk: {
      ...live,
      feed_status: "VERIFIED_PRODUCT_FEED",
      R_core: Number(live.R_core),
    },
    loadStatus: "VERIFIED_PRODUCT_FEED",
    error: null,
    research_reference_only: researchRef,
  }
}

/**
 * Load CORE Risk UI model from public snapshot.
 */
export async function loadCoreRiskUiModel() {
  try {
    const res = await fetch(CORE_SNAPSHOT_URL, { cache: "no-store" })
    if (!res.ok) {
      return {
        core_risk: buildUnavailableCoreRiskDto("SNAPSHOT_HTTP_" + res.status),
        loadStatus: "HTTP_ERROR",
        error: `http_${res.status}`,
        research_reference_only: null,
      }
    }
    const json = await res.json()
    return adaptCoreRiskSnapshot(json)
  } catch (e) {
    return {
      core_risk: buildUnavailableCoreRiskDto("SNAPSHOT_FETCH_FAILED"),
      loadStatus: "FETCH_FAILED",
      error: e?.message || "fetch_failed",
      research_reference_only: null,
    }
  }
}

export { CORE_SNAPSHOT_URL, buildUnavailableCoreRiskDto }
