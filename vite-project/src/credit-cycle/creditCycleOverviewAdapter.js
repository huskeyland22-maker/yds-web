/**
 * Credit Cycle overview view-model — Task 155 layout + Task 156 CORE/Liquidity wiring.
 * Does not invent HY/BBB values. λ=0. Design slots unchanged.
 */

import {
  CREDIT_CYCLE_DIAGRAM_STEPS,
  REGIME_GUIDE,
  REGIME_SHORT_KO,
  TABS,
  creditRiskLevelLabel,
} from "./creditCycleContent.js"
import {
  buildCreditPositionGaugeModel,
  scoreToGaugeDeg,
} from "../content/ydsPositionGaugeModel.js"
import { UI_FEED_STATUS } from "./creditCycleBridge.js"

export const OVERVIEW_SUMMARY_IDS = [
  { id: "hy", label: "HY Spread" },
  { id: "bbb", label: "BBB Spread" },
  { id: "sloos", label: "SLOOS 대출태도" },
  { id: "term_spread", label: "장단기 금리차", optional: true },
  { id: "sofr", label: "SOFR 금리", optional: true },
  { id: "cre", label: "CRE/중소은행" },
]

/**
 * Task 156 — map integrated CORE+liquidity analysis into 155 overview slots.
 * @param {object | null} integrated
 */
export function buildCreditCycleOverviewFromIntegrated(integrated) {
  if (!integrated) {
    return { ready: false, tabs: TABS, loading: true }
  }

  const core = integrated.core_risk
  const liq = integrated.liquidity_environment
  const cci = integrated.cci_reference
  const uncalibrated = core?.calibration_status === "NOT_CALIBRATED" || !core?.risk_grade

  const gauge = buildCoreGauge(core, uncalibrated)
  const regime = buildDomainRegimeCard(integrated)
  const summary = buildIntegratedSummary(integrated)
  const tableRows = buildDomainTableRows(integrated)
  const chartPoints = buildSofrChartPoints(liq)
  const hist = integrated.core_domain_history
  const coreHistoryPoints = Array.isArray(hist?.chart_r_core) ? hist.chart_r_core : []
  const hasCoreHistory = coreHistoryPoints.length >= 2
  const checklist = (integrated.checklist || []).slice(0, 6).map((item) => ({
    id: item.id,
    label: item.label,
    state: item.state,
    stateLabel: item.stateLabel,
  }))

  const diagramSteps = CREDIT_CYCLE_DIAGRAM_STEPS.map((step) => ({
    ...step,
    // Uncalibrated CORE: do not mark a definitive active stage
    active: uncalibrated
      ? false
      : mapCoreToDiagramActive(core?.R_core, step.id),
  }))

  const dateSplit = integrated.date_split || {
    core_observation: core?.as_of || null,
    core_retrieval: core?.retrieval_date || null,
    sofr_observation: liq?.sofr?.as_of || null,
    on_rrp_observation: liq?.on_rrp?.as_of || null,
  }

  return {
    ready: true,
    loading: false,
    engine: "CORE_PRIMARY",
    tabs: TABS,
    asOf: dateSplit.core_observation || core?.as_of || null,
    dateSplit,
    feedBadge: resolveCoreFeedBadge(core, integrated.core_transport),
    pitLabel: core?.pit_class || cci?.note || null,
    statusLabel: uncalibrated ? "미보정 · 참고" : core?.r_status || null,
    coveragePct: coveragePct(core),
    hold: false,
    testSeedOnly: false,
    stagingNote: buildStagingNote(integrated),
    gauge,
    regime,
    summary,
    tableRows,
    chartPoints,
    coreHistoryPoints,
    domainSeries: {
      DS: hist?.chart_ds || [],
      DQ: hist?.chart_dq || [],
      DR: hist?.chart_dr || [],
    },
    chartLegend: [
      { id: "cci", label: "SOFR (%)", state: chartPoints.length ? "connected" : "missing" },
      {
        id: "hy",
        label: "CORE R_core 이력",
        state: hasCoreHistory ? "connected" : "unwired",
      },
      { id: "bbb", label: "ON RRP", state: liq?.on_rrp?.status === "AVAILABLE" ? "connected" : "missing" },
      { id: "term", label: "레거시 CCI", state: cci?.cci != null ? "connected" : "unwired" },
    ],
    chartUnitNote: hasCoreHistory
      ? "상단 축: SOFR % · 하단: CORE R_core 이력(점수). 단위 혼용 금지. ON RRP는 표·상세."
      : "차트 축: SOFR % (단위 혼용 금지). CORE 도메인·ON RRP는 표·요약에서 확인.",
    diagramSteps,
    checklist,
    indicators: buildDetailIndicators(integrated),
    history: hasCoreHistory
      ? {
          CORE_R_CORE_FULL: {
            label: "CORE R_core 전체 이력",
            path: coreHistoryPoints,
            note: hist?.comparability_warning || null,
          },
        }
      : null,
    historyMeta: hist
      ? {
          ready: hist.ready,
          series_n: hist.quality?.series_n ?? 0,
          r_core_n: hist.quality?.r_core_n ?? 0,
          partial_n: hist.quality?.partial_n ?? 0,
          comparability_warning: hist.comparability_warning || null,
        }
      : null,
    cciPath: [],
    liquidityGuide: liq?.interpretation_guide || null,
    insight: integrated.insight,
    integrated,
    raw: integrated,
  }
}

/** Legacy CCI-only path (155). Kept for regression tests. */
export function buildCreditCycleOverviewModel(model) {
  if (!model) {
    return { ready: false, tabs: TABS, loading: true }
  }

  const regimeId = model.regime?.id || model.regime?.label || null
  const regimeKo = (regimeId && REGIME_SHORT_KO[regimeId]) || regimeId || "미확정"
  const guide = REGIME_GUIDE.find((g) => g.id === regimeId) || null
  const diagramSteps = CREDIT_CYCLE_DIAGRAM_STEPS.map((step) => ({
    ...step,
    active: regimeId ? step.regimes.includes(regimeId) : false,
  }))
  const activeStep = diagramSteps.find((s) => s.active) || null

  const staleRows = (model.indicators || []).filter(
    (r) => !r.licenseRestricted && String(r.quality).toUpperCase() === "STALE",
  )

  const gaugeBase = buildCreditPositionGaugeModel({
    cci: model.cci,
    cciDisplay: model.cci == null ? "—" : String(model.cci),
    regime: regimeId,
    asOf: model.asOf,
    hold: model.hold,
    pitLabel: model.pitLabel,
    statusLabel: model.statusLabel,
    staleNames: staleRows.map((r) => r.label || r.id),
    testSeedOnly: model.testSeedOnly,
  })

  const byId = new Map((model.indicators || []).map((r) => [r.id, r]))
  const summary = OVERVIEW_SUMMARY_IDS.map((spec) => {
    const row = byId.get(spec.id) || null
    return { ...spec, ...formatLegacySummary(row) }
  })

  return {
    ready: true,
    loading: false,
    engine: "CCI_LEGACY",
    tabs: TABS,
    asOf: model.asOf || null,
    feedBadge: resolveLegacyFeedBadge(model),
    pitLabel: model.pitLabel || null,
    statusLabel: model.statusLabel || null,
    coveragePct: model.coveragePct ?? null,
    hold: Boolean(model.hold),
    testSeedOnly: Boolean(model.testSeedOnly),
    stagingNote: model.stagingApiNote || null,
    gauge: gaugeBase,
    regime: {
      id: regimeId,
      labelKo: regimeKo,
      tone: activeStep?.tone || "muted",
      meaning: guide?.meaning || "국면 판정을 확정할 데이터가 부족합니다.",
      investorCheck: guide?.investorCheck || null,
    },
    summary,
    tableRows: summary.map((s) => ({
      id: s.id,
      label: s.label,
      value: s.valueText,
      delta: s.deltaText,
      deltaTone: s.deltaTone,
      risk: s.riskLabel,
      riskTone: s.riskTone,
    })),
    chartPoints: (model.cciPath || [])
      .filter((p) => p?.cci != null)
      .map((p) => ({ asOf: String(p.asOf).slice(0, 10), cci: Number(p.cci) })),
    chartLegend: [
      { id: "cci", label: "CCI (License-safe)", state: "connected" },
      { id: "hy", label: "HY Spread", state: "license" },
      { id: "bbb", label: "BBB Spread", state: "license" },
      { id: "term", label: "장단기 금리차", state: "unwired" },
    ],
    diagramSteps,
    checklist: (model.checklist || []).slice(0, 6),
    indicators: model.indicators || [],
    history: model.history || null,
    cciPath: model.cciPath || [],
    raw: model,
  }
}

function buildCoreGauge(core, uncalibrated) {
  const score =
    core?.R_core != null && Number.isFinite(Number(core.R_core)) ? Number(core.R_core) : null
  if (score == null) {
    return {
      axis: "core",
      ready: false,
      loading: false,
      emptyLabel: "CORE 점수 대기",
      emptyHint: "검증된 R_core가 없어 게이지를 확정하지 않습니다.",
      score: null,
      scoreDisplay: "—",
      unit: "R_core",
      deg: null,
      stageLabel: null,
      asOf: core?.as_of || null,
      bands: [],
      footnotes: [],
    }
  }
  const deg = scoreToGaugeDeg(score)
  return {
    axis: "core",
    ready: deg != null,
    loading: false,
    score,
    scoreDisplay: String(score),
    unit: " / 100",
    deg,
    stageLabel: uncalibrated ? "미보정 · 참고" : "참고",
    stageColor: "#a78bfa",
    stageBlurb: null,
    asOf: core?.as_of || null,
    bands: [
      { id: "low", min: 0, max: 19, label: "낮음", color: "#22c55e" },
      { id: "below_avg", min: 20, max: 39, label: "평균↓", color: "#84cc16" },
      { id: "watch", min: 40, max: 59, label: "주시", color: "#eab308" },
      { id: "elevated", min: 60, max: 79, label: "상승", color: "#f97316" },
      { id: "extreme", min: 80, max: 100, label: "극단", color: "#ef4444" },
    ],
    footnotes: [
      `calibration=${core.calibration_status || "NOT_CALIBRATED"}`,
      "λ=0 · D_liquidity 미합산",
    ],
  }
}

function buildDomainRegimeCard(integrated) {
  const d = integrated.domains || {}
  const lines = [
    `공급(DS) ${fmtScore(d.DS?.score)} · ${d.DS?.status || "—"}`,
    `규모(DQ) ${fmtScore(d.DQ?.score)} · ${d.DQ?.status || "—"}`,
    `부실(DR) ${fmtScore(d.DR?.score)} · ${d.DR?.status || "—"}`,
    `유동성 ${integrated.liquidity_environment?.D_liquidity?.status || "—"} (R_core 미합산)`,
  ]
  const conflict = integrated.cross_domain?.core_vs_liquidity || "SEPARATE_TRACKS"
  return {
    id: "core_domains",
    labelKo: integrated.weakest_domain
      ? `취약: ${integrated.weakest_domain.label}`
      : "CORE 도메인",
    tone:
      integrated.weakest_domain?.score >= 70
        ? "red"
        : integrated.weakest_domain?.score >= 45
          ? "yellow"
          : "green",
    meaning: lines.join(" · "),
    investorCheck: `교차=${conflict} · ${integrated.insight?.limits?.[0] || "미보정 가능"}`,
  }
}

function buildIntegratedSummary(integrated) {
  const core = integrated.core_risk
  const liq = integrated.liquidity_environment
  const weakest = integrated.weakest_domain
  const easing = integrated.easing_domain
  const rows = [
    {
      id: "weakest",
      label: "가장 취약한 CORE",
      tone: weakest?.score >= 70 ? "warn" : "neutral",
      status: weakest?.label || "—",
      detail: weakest ? `점수 ${weakest.score}` : "데이터 부족",
      mark: weakest?.score >= 70 ? "!" : "•",
      available: Boolean(weakest),
      valueText: weakest ? String(weakest.score) : "—",
      deltaText: "—",
      deltaTone: "",
      riskLabel: weakest?.status || "—",
      riskTone: "muted",
    },
    {
      id: "easing",
      label: "완화 쪽 CORE",
      tone: "good",
      status: easing?.label || "—",
      detail: easing ? `점수 ${easing.score}` : "데이터 부족",
      mark: "✓",
      available: Boolean(easing),
      valueText: easing ? String(easing.score) : "—",
      deltaText: "—",
      deltaTone: "",
      riskLabel: easing?.status || "—",
      riskTone: "green",
    },
    {
      id: "sofr",
      label: "SOFR 변화",
      tone: "neutral",
      status: liq?.sofr?.status === "AVAILABLE" ? "AVAILABLE" : "데이터 부족",
      detail: liq?.sofr?.interpretation || "—",
      mark: "•",
      available: liq?.sofr?.latest != null,
      valueText: liq?.sofr?.latest != null ? String(liq.sofr.latest) : "—",
      deltaText:
        liq?.sofr?.delta_approx_5d != null
          ? `${liq.sofr.delta_approx_5d > 0 ? "+" : ""}${liq.sofr.delta_approx_5d.toFixed(2)}`
          : "—",
      deltaTone: "",
      riskLabel: "참고",
      riskTone: "muted",
    },
    {
      id: "on_rrp",
      label: "ON RRP 변화",
      tone: "neutral",
      status: liq?.on_rrp?.status === "AVAILABLE" ? "AVAILABLE" : "데이터 부족",
      detail: liq?.on_rrp?.interpretation || "—",
      mark: "•",
      available: liq?.on_rrp?.latest != null,
      valueText:
        liq?.on_rrp?.latest_billions != null
          ? `${liq.on_rrp.latest_billions.toFixed(2)}B`
          : "—",
      deltaText:
        liq?.on_rrp?.delta_pct_approx_5obs != null
          ? `${liq.on_rrp.delta_pct_approx_5obs.toFixed(1)}%`
          : "—",
      deltaTone: "",
      riskLabel: "참고",
      riskTone: "muted",
    },
    {
      id: "quality",
      label: "데이터 품질",
      tone: "warn",
      status: core?.pit_class || "—",
      detail: (integrated.insight?.limits || []).slice(0, 2).join(" · ") || "—",
      mark: "!",
      available: true,
      valueText: core?.feed_status || "—",
      deltaText: "—",
      deltaTone: "",
      riskLabel: liq?.freshness || "—",
      riskTone: "orange",
    },
    {
      id: "lambda",
      label: "유동성 가중 λ",
      tone: "good",
      status: "λ=0",
      detail: "D_liquidity ∉ R_core · 검증 전 합산 금지",
      mark: "✓",
      available: true,
      valueText: "0",
      deltaText: "—",
      deltaTone: "",
      riskLabel: "분리",
      riskTone: "green",
    },
  ]
  return rows
}

function buildDomainTableRows(integrated) {
  const d = integrated.domains || {}
  const liq = integrated.liquidity_environment
  return [
    {
      id: "DS",
      label: "신용 공급",
      value: fmtScore(d.DS?.score),
      delta: d.DS?.detail?.supply_demand_divergence != null
        ? `수급괴리 ${d.DS.detail.supply_demand_divergence}`
        : "—",
      deltaTone: "",
      risk: d.DS?.status || "—",
      riskTone: toneFromStatus(d.DS?.status),
    },
    {
      id: "DQ",
      label: "대출 규모",
      value: fmtScore(d.DQ?.score),
      delta: "—",
      deltaTone: "",
      risk: d.DQ?.status || "—",
      riskTone: toneFromStatus(d.DQ?.status),
    },
    {
      id: "DR",
      label: "실제 부실",
      value: fmtScore(d.DR?.score),
      delta: "—",
      deltaTone: "",
      risk: d.DR?.status || "—",
      riskTone: toneFromStatus(d.DR?.status),
    },
    {
      id: "LIQ",
      label: "유동성 환경",
      value:
        liq?.D_liquidity?.score != null
          ? `D_liq ${liq.D_liquidity.score}`
          : "판단 보류",
      delta: `SOFR ${liq?.sofr?.latest ?? "—"} · RRP ${
        liq?.on_rrp?.latest_billions != null
          ? `${liq.on_rrp.latest_billions.toFixed(2)}B`
          : "—"
      }`,
      deltaTone: "",
      risk: liq?.D_liquidity?.status || "—",
      riskTone: "muted",
    },
  ]
}

function buildSofrChartPoints(liq) {
  const series = liq?.sofr?.series || []
  return series
    .filter((p) => p?.date && Number.isFinite(p.value))
    .map((p) => ({ asOf: p.date, cci: p.value }))
}

function buildDetailIndicators(integrated) {
  const out = []
  const liq = integrated.liquidity_environment
  for (const domain of Object.values(integrated.domains || {})) {
    for (const f of domain.features || []) {
      out.push({
        id: f.id,
        label: f.label,
        valueDisplay: f.score != null ? String(f.score) : "—",
        riskScore: f.score,
        statusLabel: f.status,
        quality: f.quality || f.status,
        freshnessStatus: f.freshness || null,
        observationDate: f.observation_date || integrated.core_risk?.as_of || null,
        retrievalDate: f.retrieval_date || integrated.core_risk?.retrieval_date || null,
        releaseDate: f.release_date ?? null,
        source: f.source || "Federal Reserve Board",
        rightsStatus: f.rights_status || "RIGHTS_PASS",
        interpretation: interpretCoreFeature(domain.id, f),
        limits: [
          "미보정 Rolling Percentile 참고 점수",
          "NON_STRICT_PIT",
          "결측을 0으로 대체하지 않음",
        ],
        licenseRestricted: false,
        domain: domain.id,
      })
    }
  }
  const sofrGuide = liq?.sofr?.guide || liq?.interpretation_guide?.sofr
  const rrpGuide = liq?.on_rrp?.guide || liq?.interpretation_guide?.on_rrp
  out.push({
    id: "SOFR",
    label: "SOFR",
    valueDisplay: liq?.sofr?.latest != null ? String(liq.sofr.latest) : "—",
    riskScore: null,
    statusLabel: liq?.sofr?.status || "NO_DATA",
    quality: liq?.freshness || "—",
    freshnessStatus: liq?.freshness || null,
    observationDate: liq?.sofr?.observation_date || liq?.sofr?.as_of || null,
    retrievalDate: liq?.sofr?.retrieval_date || liq?.retrieval_date || null,
    releaseDate: null,
    source: "NY Fed Markets API",
    rightsStatus: liq?.sofr?.rights_status || "RIGHTS_CONDITIONAL",
    interpretation: sofrGuide
      ? `${sofrGuide.observed} · ${sofrGuide.means}`
      : liq?.sofr?.interpretation || "—",
    limits: sofrGuide
      ? [sofrGuide.cannot_alone, ...(sofrGuide.next_check || []).map((x) => `다음: ${x}`)]
      : ["SOFR 단독으로 신용위험 단정 금지"],
    licenseRestricted: false,
    domain: "LIQ",
  })
  out.push({
    id: "ON_RRP",
    label: "ON RRP",
    valueDisplay:
      liq?.on_rrp?.latest_billions != null
        ? `${liq.on_rrp.latest_billions.toFixed(2)}B`
        : "—",
    riskScore: null,
    statusLabel: liq?.on_rrp?.status || "NO_DATA",
    quality: liq?.freshness || "—",
    freshnessStatus: liq?.freshness || null,
    observationDate: liq?.on_rrp?.observation_date || liq?.on_rrp?.as_of || null,
    retrievalDate: liq?.on_rrp?.retrieval_date || liq?.retrieval_date || null,
    releaseDate: null,
    source: "NY Fed Reverse Repo Operations",
    rightsStatus: liq?.on_rrp?.rights_status || "RIGHTS_CONDITIONAL",
    interpretation: rrpGuide
      ? `${rrpGuide.observed} · ${rrpGuide.means}`
      : liq?.on_rrp?.interpretation || "—",
    limits: rrpGuide
      ? [rrpGuide.cannot_alone, ...(rrpGuide.next_check || []).map((x) => `다음: ${x}`)]
      : ["rrp_decline_alone_does_not_raise_risk"],
    licenseRestricted: false,
    domain: "LIQ",
  })
  return out
}

function interpretCoreFeature(domainId, feature) {
  if (feature?.score == null) return "점수 산출 불가 또는 데이터 부족"
  if (domainId === "DS") {
    return `신용 공급 영역 점수 ${feature.score} (기준·수요 SLOOS). 공급 강화≠즉시 부실.`
  }
  if (domainId === "DQ") {
    return `대출 규모 영역 점수 ${feature.score} (H.8 C&I). 성장 둔화만으로 위기 단정 금지.`
  }
  if (domainId === "DR") {
    return `실제 부실 영역 점수 ${feature.score} (연체·상각). 실현 악화 여부를 관찰.`
  }
  return `점수 ${feature.score}`
}

function buildStagingNote(integrated) {
  const parts = []
  if (integrated.core_risk?.calibration_status === "NOT_CALIBRATED") {
    parts.push("CORE 미보정 — 확정 등급 아님")
  }
  const split = integrated.date_split
  if (split?.core_observation && split?.sofr_observation) {
    parts.push(
      `CORE 관측 ${split.core_observation} · SOFR 관측 ${split.sofr_observation}`,
    )
  }
  if (integrated.liquidity_environment?.rights?.sofr === "RIGHTS_CONDITIONAL") {
    parts.push("SOFR/ON RRP RIGHTS_CONDITIONAL · NY Fed 고지 적용")
  }
  parts.push("λ=0 · CCI≠CORE · Panic 합산 없음")
  return parts.join(" · ")
}

function resolveCoreFeedBadge(core, transport) {
  if (!core) return "CORE 미연결"
  if (core.feed_status === "VERIFIED_PRODUCT_FEED") {
    return transport === "api_core_latest" ? "CORE API · Board" : "CORE Snapshot · Board"
  }
  return core.feed_status || "CORE"
}

function resolveLegacyFeedBadge(model) {
  if (model.feedStatus === UI_FEED_STATUS.LICENSE_SAFE_LOCAL) return "License-safe · NON_PIT"
  if (model.feedStatus === UI_FEED_STATUS.STAGING_API) return "Staging API"
  return model.feedStatus || "—"
}

function coveragePct(core) {
  const cov = core?.coverage
  if (cov?.status === "OK" || cov?.domains) {
    const d = cov.domains || {}
    const n = [d.supply, d.quantity, d.realized].filter(Boolean).length
    return Math.round((n / 3) * 100)
  }
  if (core?.confidence?.coverage_domains != null) {
    return Math.round((Number(core.confidence.coverage_domains) / 3) * 100)
  }
  return null
}

function mapCoreToDiagramActive(rCore, stepId) {
  if (rCore == null || !Number.isFinite(Number(rCore))) return false
  const s = Number(rCore)
  if (s < 40) return stepId === "expansion" || stepId === "normal"
  if (s < 60) return stepId === "warning"
  return stepId === "stress"
}

function formatLegacySummary(row) {
  if (!row) {
    return {
      available: false,
      licenseRestricted: false,
      tone: "muted",
      status: "데이터 없음",
      valueText: "—",
      deltaText: "—",
      deltaTone: "",
      riskLabel: "—",
      riskTone: "muted",
      mark: "○",
      detail: "엔진 미연결",
    }
  }
  if (row.licenseRestricted) {
    return {
      available: false,
      licenseRestricted: true,
      tone: "muted",
      status: "비공개",
      valueText: "비공개",
      deltaText: "—",
      deltaTone: "",
      riskLabel: "제한",
      riskTone: "muted",
      mark: "○",
      detail: "라이선스 제한",
    }
  }
  const level = creditRiskLevelLabel(row.riskScore)
  return {
    available: true,
    licenseRestricted: false,
    tone: level?.tone === "green" ? "good" : level?.tone === "red" ? "warn" : "neutral",
    status: level?.label || row.statusLabel || "관찰",
    valueText: row.valueDisplay != null ? String(row.valueDisplay) : "—",
    deltaText: row.valueDelta != null ? String(row.valueDelta) : "—",
    deltaTone: "",
    riskLabel: level?.label || "—",
    riskTone: level?.tone || "muted",
    mark: "•",
    detail: String(row.valueDisplay ?? "—"),
  }
}

function fmtScore(v) {
  if (v == null || !Number.isFinite(Number(v))) return "—"
  return String(v)
}

function toneFromStatus(status) {
  if (status === "ELEVATED") return "red"
  if (status === "WATCH") return "yellow"
  if (status === "CONTAINED") return "green"
  return "muted"
}
