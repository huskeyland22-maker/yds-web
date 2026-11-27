/**
 * CORE DS/DQ/DR domain history — product adapter.
 * Separate from live tip snapshot. Never invents scores or fills null with 0.
 */

const HISTORY_URL = "/credit-cycle/core-domain-history.json"

const FEATURE_OBS_KEYS = {
  CREDIT_SUPPLY_SLOOS_CI_STANDARDS_LARGE_MEDIUM: "STANDARDS_LM",
  CREDIT_SUPPLY_SLOOS_CI_STANDARDS_SMALL: "STANDARDS_SMALL",
  CREDIT_SUPPLY_SLOOS_CI_DEMAND_LARGE_MEDIUM: "DEMAND_LM",
  CREDIT_SUPPLY_SLOOS_CI_DEMAND_SMALL: "DEMAND_SMALL",
  CREDIT_QUANTITY_H8_CI_LOANS_SA: "H8_LEVEL",
  CREDIT_QUANTITY_H8_CI_YOY_52W: "H8_YOY",
  CREDIT_REALIZED_CI_DELINQUENCY_SA: "DELINQUENCY",
  CREDIT_REALIZED_CI_CHARGEOFF_SA: "CHARGEOFF",
}

/**
 * @param {object} json
 */
export function adaptCoreDomainHistory(json) {
  if (!json || !Array.isArray(json.series)) {
    return {
      ready: false,
      series: [],
      rCoreSeries: [],
      tip: null,
      quality: { status: "NO_DATA" },
      notes: ["core domain history unavailable"],
    }
  }

  const series = json.series
    .map((p) => ({
      as_of: String(p.as_of || "").slice(0, 10),
      observation_date: String(p.observation_date || p.as_of || "").slice(0, 10),
      DS: finiteOrNull(p.DS),
      DQ: finiteOrNull(p.DQ),
      DR: finiteOrNull(p.DR),
      R_core: finiteOrNull(p.R_core),
      coverage: p.coverage || "UNKNOWN",
      pit_class: p.pit_class || json.quality?.pit_class || "NON_STRICT_PIT",
      conflict_flags: Array.isArray(p.conflict_flags) ? p.conflict_flags : [],
    }))
    .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.as_of))
    .sort((a, b) => a.as_of.localeCompare(b.as_of))

  const rCoreSeries = series.filter((p) => p.R_core != null)
  const full = series.filter((p) => p.coverage === "FULL")
  const partial = series.filter((p) => p.coverage === "PARTIAL_COVERAGE")

  return {
    ready: series.length > 0,
    schema_version: json.schema_version || null,
    generated_at: json.generated_at || null,
    source: json.source || null,
    tip: json.tip || rCoreSeries.at(-1) || null,
    series,
    rCoreSeries,
    chart_r_core: rCoreSeries.map((p) => ({ asOf: p.as_of, cci: p.R_core })),
    chart_ds: series.filter((p) => p.DS != null).map((p) => ({ asOf: p.as_of, cci: p.DS })),
    chart_dq: series.filter((p) => p.DQ != null).map((p) => ({ asOf: p.as_of, cci: p.DQ })),
    chart_dr: series.filter((p) => p.DR != null).map((p) => ({ asOf: p.as_of, cci: p.DR })),
    quality: {
      status: series.length ? "AVAILABLE" : "NO_DATA",
      pit_class: json.quality?.pit_class || "NON_STRICT_PIT",
      series_n: series.length,
      r_core_n: rCoreSeries.length,
      full_n: full.length,
      partial_n: partial.length,
      incomplete_windows_explicit: partial.length > 0,
    },
    notes: Array.isArray(json.notes) ? json.notes : [],
    comparability_warning:
      "과거 R_core와 현재 tip의 산출 조건(미보정 WINDOW/GRADE)이 동일 비교 기준이 아닐 수 있습니다.",
  }
}

export async function loadCoreDomainHistory() {
  try {
    const res = await fetch(HISTORY_URL, { cache: "no-store" })
    if (!res.ok) {
      return adaptCoreDomainHistory(null)
    }
    return adaptCoreDomainHistory(await res.json())
  } catch {
    return adaptCoreDomainHistory(null)
  }
}

/**
 * Map Board panel_quality.last → per-feature observation dates (no invention).
 * @param {Record<string, {last?: string, first?: string, n?: number, n_future_vs_retrieval?: number}>|null} panelQuality
 * @param {string|null} retrievalDate
 */
export function buildFeatureDateMeta(panelQuality, retrievalDate = null) {
  const out = {}
  for (const [featureId, shortKey] of Object.entries(FEATURE_OBS_KEYS)) {
    const q = panelQuality?.[shortKey]
    if (!q?.last) {
      out[featureId] = {
        observation_date: null,
        retrieval_date: retrievalDate,
        release_date: null,
        freshness: "NO_DATA",
        availability: "NO_DATA",
      }
      continue
    }
    const obs = String(q.last).slice(0, 10)
    const futureLeak = Number(q.n_future_vs_retrieval || 0) > 0
    out[featureId] = {
      observation_date: obs,
      retrieval_date: retrievalDate,
      release_date: null,
      source: "Federal Reserve Board (DDP/HTML)",
      availability: "AVAILABLE",
      freshness: classifyFreshness(obs, retrievalDate, shortKey),
      quality: futureLeak ? "NON_STRICT_PIT" : "NON_STRICT_PIT",
      rights_status: "RIGHTS_PASS",
      panel_n: q.n ?? null,
      note: futureLeak
        ? "Board series tip may include period beyond retrieval — scored tip uses validated as_of"
        : null,
    }
  }
  return out
}

function classifyFreshness(obs, retrieval, shortKey) {
  if (!obs) return "NO_DATA"
  const ageDays = (Date.now() - Date.parse(`${obs}T00:00:00Z`)) / 86400000
  if (!Number.isFinite(ageDays)) return "UNKNOWN_FRESHNESS"
  // Quarterly Board series (SLOOS / delinquency / chargeoff)
  const quarterly = /STANDARDS|DEMAND|DELINQUENCY|CHARGEOFF/.test(shortKey)
  if (quarterly) {
    if (ageDays <= 120) return "AVAILABLE"
    if (ageDays <= 200) return "RELEASE_DELAYED"
    return "STALE"
  }
  // Weekly H.8
  if (ageDays <= 21) return "AVAILABLE"
  if (ageDays <= 45) return "STALE"
  return "RELEASE_DELAYED"
}

function finiteOrNull(v) {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
