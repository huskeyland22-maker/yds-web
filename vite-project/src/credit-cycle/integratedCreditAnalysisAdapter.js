/**
 * Integrated credit analysis DTO — CORE + Liquidity Environment + optional CCI reference.
 * Never averages CCI / R_core / D_liquidity. λ=0.
 */

import { loadCoreRiskProductModel } from "./coreStagingBridge.js"
import { loadLiquidityEnvironment, LIQUIDITY_LAMBDA } from "./liquidityEnvironmentAdapter.js"
import { loadCreditCycleUiModel } from "./creditCycleBridge.js"
import {
  loadCoreDomainHistory,
  buildFeatureDateMeta,
} from "./coreDomainHistoryAdapter.js"

const FEATURE_LABELS = {
  CREDIT_SUPPLY_SLOOS_CI_STANDARDS_LARGE_MEDIUM: "SLOOS 기준(대중견)",
  CREDIT_SUPPLY_SLOOS_CI_STANDARDS_SMALL: "SLOOS 기준(소기업)",
  CREDIT_SUPPLY_SLOOS_CI_DEMAND_LARGE_MEDIUM: "SLOOS 수요(대중견)",
  CREDIT_SUPPLY_SLOOS_CI_DEMAND_SMALL: "SLOOS 수요(소기업)",
  CREDIT_QUANTITY_H8_CI_LOANS_SA: "H.8 C&I 잔액성장",
  CREDIT_QUANTITY_H8_CI_YOY_52W: "H.8 C&I YoY",
  CREDIT_REALIZED_CI_DELINQUENCY_SA: "C&I 연체율",
  CREDIT_REALIZED_CI_CHARGEOFF_SA: "C&I 상각률",
}

/**
 * @param {{ coreModel?: object, liquidity?: object, cciModel?: object | null, domainHistory?: object | null, panelQuality?: object | null }} parts
 */
export function buildIntegratedCreditAnalysis(parts = {}) {
  const core = parts.coreModel?.core_risk || null
  const liq = parts.liquidity || null
  const cci = parts.cciModel || null
  const domainHistory = parts.domainHistory || null
  const featureDates = buildFeatureDateMeta(
    parts.panelQuality || null,
    core?.retrieval_date || parts.coreModel?.refresh?.last_success_collection || null,
  )

  const domains = {
    DS: {
      id: "DS",
      label: "신용 공급",
      score: core?.domain_scores?.supply ?? null,
      detail: core?.domain_detail
        ? {
            standards: core.domain_detail.standards_block ?? null,
            demand: core.domain_detail.demand_block ?? null,
            size_divergence: core.domain_detail.size_divergence ?? null,
            supply_demand_divergence: core.domain_detail.supply_demand_divergence ?? null,
          }
        : null,
      features: pickFeatures(core, [
        "CREDIT_SUPPLY_SLOOS_CI_STANDARDS_LARGE_MEDIUM",
        "CREDIT_SUPPLY_SLOOS_CI_STANDARDS_SMALL",
        "CREDIT_SUPPLY_SLOOS_CI_DEMAND_LARGE_MEDIUM",
        "CREDIT_SUPPLY_SLOOS_CI_DEMAND_SMALL",
      ], featureDates),
      status: statusFromScore(core?.domain_scores?.supply),
    },
    DQ: {
      id: "DQ",
      label: "대출 규모",
      score: core?.domain_scores?.quantity ?? null,
      features: pickFeatures(core, [
        "CREDIT_QUANTITY_H8_CI_LOANS_SA",
        "CREDIT_QUANTITY_H8_CI_YOY_52W",
      ], featureDates),
      status: statusFromScore(core?.domain_scores?.quantity),
    },
    DR: {
      id: "DR",
      label: "실제 부실",
      score: core?.domain_scores?.realized ?? null,
      features: pickFeatures(core, [
        "CREDIT_REALIZED_CI_DELINQUENCY_SA",
        "CREDIT_REALIZED_CI_CHARGEOFF_SA",
      ], featureDates),
      status: statusFromScore(core?.domain_scores?.realized),
    },
  }

  const weakest = [...Object.values(domains)]
    .filter((d) => d.score != null)
    .sort((a, b) => b.score - a.score)[0] || null

  const easing = [...Object.values(domains)]
    .filter((d) => d.score != null)
    .sort((a, b) => a.score - b.score)[0] || null

  const conflicts = Array.isArray(core?.conflict_flags) ? core.conflict_flags : []
  const cross = {
    core_vs_liquidity:
      liq?.D_liquidity?.status === "INSUFFICIENT_DATA" || core?.R_core == null
        ? "INSUFFICIENT_DATA"
        : conflicts.length
          ? "CORE_INTERNAL_CONFLICT"
          : liq?.co_movement?.status === "DIVERGE"
            ? "LIQUIDITY_DIVERGE_FROM_SIMPLE_READ"
            : "SEPARATE_TRACKS",
    note: "CORE·유동성·CCI를 합산하지 않습니다.",
    lambda: LIQUIDITY_LAMBDA,
    r_core_includes_liquidity: false,
  }

  const checklist = buildCoreLiquidityChecklist(domains, liq)

  const insight = {
    core_level:
      core?.R_core == null
        ? "CORE 점수 확정 불가 또는 미검증"
        : `R_core=${core.R_core} (calibration=${core.calibration_status || "NOT_CALIBRATED"})`,
    weakest_domain: weakest ? `${weakest.label} ${weakest.score}` : null,
    easing_domain: easing ? `${easing.label} ${easing.score}` : null,
    supply_quantity:
      domains.DS.score != null && domains.DQ.score != null
        ? `공급 ${domains.DS.score} · 규모 ${domains.DQ.score}`
        : null,
    realized: domains.DR.score != null ? `부실 ${domains.DR.score}` : null,
    liquidity:
      liq?.D_liquidity?.status === "INSUFFICIENT_DATA"
        ? "유동성 판단 보류"
        : `SOFR ${liq?.sofr?.latest ?? "—"} · ON RRP ${fmtBillions(liq?.on_rrp?.latest_billions)}B · D_liq=${liq?.D_liquidity?.score ?? "null"}`,
    cross: cross.note,
    limits: [
      core?.calibration_status === "NOT_CALIBRATED" ? "CORE 미보정 — 확정 등급 아님" : null,
      core?.pit_class || "NON_STRICT_PIT",
      liq?.rights?.sofr === "RIGHTS_CONDITIONAL" ? "SOFR/ON RRP RIGHTS_CONDITIONAL" : null,
      "λ=0 · D_liquidity ∉ R_core",
      "CCI ≠ CORE",
    ].filter(Boolean),
    next_watch: [
      weakest ? `${weakest.label} 재확인` : "CORE 도메인 커버리지 확인",
      "SOFR·ON RRP 동행/비동행 지속성",
      conflicts[0]?.code || null,
    ].filter(Boolean),
  }

  const dateSplit = {
    core_observation: core?.as_of || core?.observation_period || null,
    core_retrieval: core?.retrieval_date || null,
    sofr_observation: liq?.sofr?.observation_date || liq?.sofr?.as_of || null,
    on_rrp_observation: liq?.on_rrp?.observation_date || liq?.on_rrp?.as_of || null,
    liquidity_retrieval: liq?.retrieval_date || null,
    note: "CORE 관측일과 SOFR/ON RRP 관측일은 다를 수 있으며 단일 날짜로 최신성을 주장하지 않습니다.",
  }

  return {
    schema_version: "integrated_credit_analysis-0.1.1",
    core_risk: core,
    core_load_status: parts.coreModel?.loadStatus || null,
    core_transport: parts.coreModel?.transport || null,
    core_refresh: parts.coreModel?.refresh || null,
    liquidity_environment: liq,
    core_domain_history: domainHistory,
    feature_dates: featureDates,
    date_split: dateSplit,
    domains,
    weakest_domain: weakest,
    easing_domain: easing,
    cross_domain: cross,
    overall_status:
      core?.R_core != null
        ? core.calibration_status === "NOT_CALIBRATED"
          ? "CORE_READY_UNCALIBRATED"
          : "CORE_READY"
        : "CORE_INSUFFICIENT",
    checklist,
    insight,
    cci_reference: cci
      ? {
          cci: cci.cci ?? null,
          as_of: cci.asOf ?? null,
          regime: cci.regime?.id || cci.regime?.label || null,
          note: "레거시 CCI — CORE와 별도. 합산 금지.",
        }
      : null,
    lambda: LIQUIDITY_LAMBDA,
    independent_of: ["panic", "soft_state", "legacy_cci_merge", "liquidity_into_r_core"],
  }
}

export async function loadIntegratedCreditAnalysis() {
  const [coreModel, liquidity, cciModel, domainHistory] = await Promise.all([
    loadCoreRiskProductModel().catch(() => null),
    loadLiquidityEnvironment().catch(() => null),
    loadCreditCycleUiModel().catch(() => null),
    loadCoreDomainHistory().catch(() => null),
  ])
  let panelQuality = null
  try {
    const snapRes = await fetch("/credit-cycle/core-r-core-snapshot.json", {
      cache: "no-store",
    })
    if (snapRes.ok) {
      const snap = await snapRes.json()
      panelQuality = snap?.panel_quality || null
    }
  } catch {
    /* optional */
  }
  return buildIntegratedCreditAnalysis({
    coreModel,
    liquidity,
    cciModel,
    domainHistory,
    panelQuality,
  })
}

function pickFeatures(core, ids, featureDates = {}) {
  const map = core?.feature_scores_by_id || {}
  return ids.map((id) => {
    const row = map[id]
    const dates = featureDates[id] || {}
    return {
      id,
      label: FEATURE_LABELS[id] || id,
      score: row?.score ?? null,
      status: row?.status || (row ? "OK" : "NO_DATA"),
      n: row?.n ?? null,
      reason: row?.reason ?? null,
      observation_date: dates.observation_date || core?.as_of || null,
      retrieval_date: dates.retrieval_date || core?.retrieval_date || null,
      release_date: dates.release_date ?? null,
      source: dates.source || "Federal Reserve Board",
      freshness: dates.freshness || null,
      quality: dates.quality || core?.pit_class || "NON_STRICT_PIT",
      rights_status: dates.rights_status || "RIGHTS_PASS",
    }
  })
}

function statusFromScore(score) {
  if (score == null || !Number.isFinite(Number(score))) return "INSUFFICIENT_DATA"
  const s = Number(score)
  if (s >= 70) return "ELEVATED"
  if (s >= 45) return "WATCH"
  return "CONTAINED"
}

function buildCoreLiquidityChecklist(domains, liq) {
  const f = (id) => {
    for (const d of Object.values(domains)) {
      const hit = d.features?.find((x) => x.id === id)
      if (hit) return hit
    }
    return null
  }
  const items = [
    {
      id: "sloos_standards",
      label: "SLOOS 대출 기준 강화",
      feature: f("CREDIT_SUPPLY_SLOOS_CI_STANDARDS_LARGE_MEDIUM"),
    },
    {
      id: "sloos_demand",
      label: "대출 수요 약화",
      feature: f("CREDIT_SUPPLY_SLOOS_CI_DEMAND_LARGE_MEDIUM"),
    },
    {
      id: "h8_yoy",
      label: "C&I 대출 성장 둔화",
      feature: f("CREDIT_QUANTITY_H8_CI_YOY_52W"),
    },
    {
      id: "delinq",
      label: "연체율 상승",
      feature: f("CREDIT_REALIZED_CI_DELINQUENCY_SA"),
    },
    {
      id: "chargeoff",
      label: "상각률 상승",
      feature: f("CREDIT_REALIZED_CI_CHARGEOFF_SA"),
    },
    {
      id: "liquidity_cross",
      label: "유동성 환경 변화·CORE 충돌",
      feature: null,
      liquidity: liq,
    },
  ]

  return items.map((item) => {
    if (item.id === "liquidity_cross") {
      if (!liq || liq.D_liquidity?.status === "INSUFFICIENT_DATA") {
        return { ...item, state: "INSUFFICIENT_DATA", stateLabel: "데이터 부족" }
      }
      if (liq.co_movement?.status === "DIVERGE") {
        return { ...item, state: "WATCH", stateLabel: "주의 · 비동행 관찰" }
      }
      return { ...item, state: "CLEAR", stateLabel: "분리 관찰 · 확정 신호 아님" }
    }
    const score = item.feature?.score
    if (score == null) {
      return { ...item, state: "INSUFFICIENT_DATA", stateLabel: "데이터 부족" }
    }
    if (score >= 70) return { ...item, state: "FLAGGED", stateLabel: "확인됨(점수 높음·미보정)" }
    if (score >= 45) return { ...item, state: "WATCH", stateLabel: "주의" }
    return { ...item, state: "CLEAR", stateLabel: "완화·낮음 쪽" }
  })
}

function fmtBillions(v) {
  if (v == null || !Number.isFinite(Number(v))) return "—"
  return Number(v).toFixed(2)
}
