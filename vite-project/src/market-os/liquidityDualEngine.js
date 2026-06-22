/**
 * 유동성 환경 V3 — 시장 유동성 + 정책 유동성 (실측·규칙 기반)
 */

import { dxyInterestScore, pickDxyValue, pickUs10yValue, pickSnapshotMetricValue } from "../utils/macroTimingAuxScores.js"

/** @typedef {'very_favorable'|'favorable'|'neutral'|'alert'|'danger'} LiquidityBandId */
/** @typedef {'ok'|'warn'} LiquidityFactorTone */

/**
 * @typedef {{
 *   label: string
 *   tone: LiquidityFactorTone
 * }} LiquidityFactorLine
 */

/**
 * @typedef {{
 *   id: LiquidityBandId
 *   label: string
 *   tone: 'favorable' | 'neutral' | 'alert' | 'danger'
 * }} LiquidityBand
 */

/** @typedef {'positive'|'neutral'|'negative'} ContributionTone */

/**
 * @typedef {{
 *   id: string
 *   label: string
 *   contribution: number
 *   metricScore: number | null
 *   tone: ContributionTone
 *   tooltip: string
 *   barPct: number
 * }} LiquidityContributionRow
 */

/**
 * @typedef {{
 *   kind: 'market' | 'policy'
 *   title: string
 *   score: number | null
 *   band: LiquidityBand
 *   factors: LiquidityFactorLine[]
 *   contributions: LiquidityContributionRow[]
 * }} LiquidityLaneCard
 */

/**
 * @typedef {{
 *   visible: boolean
 *   market: LiquidityLaneCard
 *   policy: LiquidityLaneCard
 *   marketScore: number | null
 *   policyScore: number | null
 *   actionMode: 'aggressive' | 'defense' | 'short_term' | 'medium_long' | 'balanced'
 * }} DualLiquidityReport
 */

/** @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot @param {string} key */
function metricRow(snapshot, key) {
  const rows = [
    ...(snapshot?.tieredMetrics?.tier1 ?? []),
    ...(snapshot?.tieredMetrics?.tier2 ?? []),
  ]
  return rows.find((r) => r.key === key) ?? null
}

/** @param {unknown} v */
function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** @param {number} n @param {number} min @param {number} max */
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

/** @param {LiquidityMetricV2[]} metrics */
function weightedScore(metrics) {
  let weighted = 0
  let weightSum = 0
  for (const m of metrics) {
    if (m.score == null) continue
    weighted += m.score * m.weight
    weightSum += m.weight
  }
  if (!weightSum) return null
  return Math.round(clamp(weighted / weightSum, 0, 100))
}

/**
 * @typedef {{ id: string; weight: number; score: number | null }} LiquidityMetricV2
 */

/** @param {number | null} v */
function scoreVixLiquidity(v) {
  if (v == null) return null
  if (v <= 14) return 92
  if (v <= 17) return 78
  if (v <= 20) return 62
  if (v <= 25) return 45
  if (v <= 30) return 28
  return 12
}

/** @param {number | null} v */
function scoreHyLiquidity(v) {
  if (v == null) return null
  if (v <= 3.5) return 88
  if (v <= 4.2) return 72
  if (v <= 5.0) return 52
  if (v <= 5.8) return 32
  return 12
}

/** @param {number | null} v */
function scoreMoveLiquidity(v) {
  if (v == null) return null
  if (v <= 90) return 85
  if (v <= 105) return 68
  if (v <= 120) return 48
  if (v <= 135) return 30
  return 12
}

/** @param {number | null} v */
function scoreUs10yLiquidity(v) {
  if (v == null) return null
  if (v <= 3.8) return 90
  if (v <= 4.2) return 75
  if (v <= 4.6) return 55
  if (v <= 5.0) return 35
  return 15
}

/** @param {number | null} score @param {'market' | 'policy'} kind */
export function resolveLiquidityBand(score, kind = "market") {
  if (score == null) {
    return { id: /** @type {const} */ ("neutral"), label: "중립", tone: /** @type {const} */ ("neutral") }
  }

  if (kind === "policy") {
    if (score >= 80) return { id: "very_favorable", label: "완화 우호", tone: "favorable" }
    if (score >= 60) return { id: "favorable", label: "완화 기조", tone: "favorable" }
    if (score >= 40) return { id: "neutral", label: "중립", tone: "neutral" }
    if (score >= 20) return { id: "alert", label: "긴축 우려", tone: "alert" }
    return { id: "danger", label: "긴축 강화", tone: "danger" }
  }

  if (score >= 80) return { id: "very_favorable", label: "매우 우호", tone: "favorable" }
  if (score >= 60) return { id: "favorable", label: "우호", tone: "favorable" }
  if (score >= 40) return { id: "neutral", label: "중립", tone: "neutral" }
  if (score >= 20) return { id: "alert", label: "경계", tone: "alert" }
  return { id: "danger", label: "위험", tone: "danger" }
}

/** @param {number | null} market @param {number | null} policy */
export function resolveLiquidityActionMode(market, policy) {
  const m = market ?? 50
  const p = policy ?? 50

  if (m >= 60 && p >= 60) return "aggressive"
  if (m < 40 && p < 40) return "defense"
  if (m > p + 5) return "short_term"
  if (p > m + 5) return "medium_long"
  return "balanced"
}

/** @param {number | null} metricScore */
function resolveContributionTone(metricScore) {
  if (metricScore == null) return /** @type {const} */ ("neutral")
  if (metricScore >= 60) return /** @type {const} */ ("positive")
  if (metricScore >= 40) return /** @type {const} */ ("neutral")
  return /** @type {const} */ ("negative")
}

/**
 * @param {Array<{ id: string; label: string; weight: number; score: number | null; tooltip: string }>} defs
 * @param {number | null} scoreTotal
 */
function buildContributionRows(defs, scoreTotal) {
  /** @type {LiquidityContributionRow[]} */
  const rows = defs.map((def) => {
    const contribution = def.score != null ? Math.round(def.score * def.weight) : 0
    return {
      id: def.id,
      label: def.label,
      contribution,
      metricScore: def.score,
      tone: resolveContributionTone(def.score),
      tooltip: def.tooltip,
      barPct: 0,
    }
  })

  const target = scoreTotal ?? rows.reduce((sum, row) => sum + row.contribution, 0)
  const sum = rows.reduce((acc, row) => acc + row.contribution, 0)
  if (rows.length && sum !== target) {
    rows[rows.length - 1].contribution += target - sum
  }

  const maxContrib = Math.max(...rows.map((row) => row.contribution), 1)
  for (const row of rows) {
    row.barPct = Math.max(8, Math.round((row.contribution / maxContrib) * 100))
  }

  return rows
}

const MARKET_CONTRIBUTION_TOOLTIPS = {
  vix: "주식시장 공포",
  hy: "신용위험",
  move: "채권시장 변동성",
  us10y: "할인율 부담",
  dxy: "글로벌 달러 유동성",
}

const POLICY_CONTRIBUTION_TOOLTIPS = {
  cpi: "헤드라인 인플레이션 추세",
  core: "근원 인플레이션 추세",
  pce: "연준 선호 물가 지표",
  dot: "시장 금리인하 기대",
  fed: "연준 통화정책 스탠스",
}

/** @param {import("../macro-risk/displayMetrics.js").MetricDisplayRow | null | undefined} row */
function scoreTrendEasing(row) {
  if (!row) return 50
  if (row.slope === "down") return 82
  if (row.slope === "flat") return 54
  if (row.slope === "up") return 26
  return 50
}

/**
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot
 * @param {object | null | undefined} panicData
 */
function buildMarketLiquidity(snapshot, panicData) {
  const vix = toNum(panicData?.vix)
  const hy = toNum(panicData?.highYield ?? panicData?.hyOas)
  const move = toNum(panicData?.move ?? pickSnapshotMetricValue(snapshot, "MOVE"))
  const us10 = pickUs10yValue(panicData, snapshot)
  const dxy = pickDxyValue(panicData) ?? pickSnapshotMetricValue(snapshot, "DXY")

  const metrics = [
    { id: "vix", weight: 0.25, score: scoreVixLiquidity(vix) },
    { id: "hy", weight: 0.25, score: scoreHyLiquidity(hy) },
    { id: "move", weight: 0.2, score: scoreMoveLiquidity(move) },
    { id: "us10y", weight: 0.15, score: scoreUs10yLiquidity(us10) },
    { id: "dxy", weight: 0.15, score: dxy != null ? dxyInterestScore(dxy) : null },
  ]

  const score = weightedScore(metrics)
  const band = resolveLiquidityBand(score, "market")

  const contributions = buildContributionRows(
    [
      {
        id: "vix",
        label: "VIX",
        weight: 0.25,
        score: metrics[0].score,
        tooltip: MARKET_CONTRIBUTION_TOOLTIPS.vix,
      },
      {
        id: "hy",
        label: "HY Spread",
        weight: 0.25,
        score: metrics[1].score,
        tooltip: MARKET_CONTRIBUTION_TOOLTIPS.hy,
      },
      {
        id: "move",
        label: "MOVE",
        weight: 0.2,
        score: metrics[2].score,
        tooltip: MARKET_CONTRIBUTION_TOOLTIPS.move,
      },
      {
        id: "us10y",
        label: "10Y Yield",
        weight: 0.15,
        score: metrics[3].score,
        tooltip: MARKET_CONTRIBUTION_TOOLTIPS.us10y,
      },
      {
        id: "dxy",
        label: "DXY",
        weight: 0.15,
        score: metrics[4].score,
        tooltip: MARKET_CONTRIBUTION_TOOLTIPS.dxy,
      },
    ],
    score,
  )

  const vixOk = (metrics[0].score ?? 0) >= 60
  const hyOk = (metrics[1].score ?? 0) >= 60
  const moveOk = (metrics[2].score ?? 0) >= 60
  const dxyWarn = (metrics[4].score ?? 100) < 55
  const rateWarn = (metrics[3].score ?? 100) < 55

  /** @type {LiquidityFactorLine[]} */
  const factors = [
    { label: vixOk ? "VIX 안정" : "VIX 상승", tone: vixOk ? "ok" : "warn" },
    { label: hyOk ? "신용위험 양호" : "신용위험 경계", tone: hyOk ? "ok" : "warn" },
    { label: moveOk ? "채권시장 안정" : "채권 변동성 확대", tone: moveOk ? "ok" : "warn" },
    { label: dxyWarn ? "달러 강세" : "달러 중립", tone: dxyWarn ? "warn" : "ok" },
    { label: rateWarn ? "금리 부담" : "금리 안정", tone: rateWarn ? "warn" : "ok" },
  ]

  return {
    kind: /** @type {const} */ ("market"),
    title: "시장 유동성",
    score,
    band,
    factors,
    contributions,
  }
}

/**
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot
 */
function buildPolicyLiquidity(snapshot) {
  const infPillar = snapshot?.pillars?.find((p) => p.id === "inflation")
  const ratePillar = snapshot?.pillars?.find((p) => p.id === "rate")
  const bei = metricRow(snapshot, "BEI")
  const us2y = metricRow(snapshot, "US2Y")

  const cpiScore = infPillar ? clamp(100 - (infPillar.score ?? 50), 0, 100) : 50
  const coreScore = scoreTrendEasing(bei)
  const pceLine = infPillar?.lines?.find((l) => l.label === "PCE")
  const pceScore = pceLine?.text?.includes("둔화") ? 78 : pceLine?.text?.includes("후행") ? 52 : 38
  const dotScore = scoreTrendEasing(bei)
  const fedScore = ratePillar ? clamp(100 - (ratePillar.score ?? 50), 0, 100) : scoreTrendEasing(us2y)

  const metrics = [
    { id: "cpi", weight: 0.2, score: cpiScore },
    { id: "core", weight: 0.2, score: coreScore },
    { id: "pce", weight: 0.2, score: pceScore },
    { id: "dot", weight: 0.2, score: dotScore },
    { id: "fed", weight: 0.2, score: fedScore },
  ]

  const score = weightedScore(metrics)
  const band = resolveLiquidityBand(score, "policy")

  const contributions = buildContributionRows(
    [
      {
        id: "cpi",
        label: "CPI",
        weight: 0.2,
        score: metrics[0].score,
        tooltip: POLICY_CONTRIBUTION_TOOLTIPS.cpi,
      },
      {
        id: "core",
        label: "Core CPI",
        weight: 0.2,
        score: metrics[1].score,
        tooltip: POLICY_CONTRIBUTION_TOOLTIPS.core,
      },
      {
        id: "pce",
        label: "PCE",
        weight: 0.2,
        score: metrics[2].score,
        tooltip: POLICY_CONTRIBUTION_TOOLTIPS.pce,
      },
      {
        id: "dot",
        label: "Dot Plot",
        weight: 0.2,
        score: metrics[3].score,
        tooltip: POLICY_CONTRIBUTION_TOOLTIPS.dot,
      },
      {
        id: "fed",
        label: "Fed 발언",
        weight: 0.2,
        score: metrics[4].score,
        tooltip: POLICY_CONTRIBUTION_TOOLTIPS.fed,
      },
    ],
    score,
  )

  const cpiUp = (metrics[0].score ?? 50) < 45
  const cutHopeLow = (metrics[3].score ?? 50) < 45
  const hawkish = (metrics[4].score ?? 50) < 45
  const recessionLow = (infPillar?.score ?? 50) < 55

  /** @type {LiquidityFactorLine[]} */
  const factors = [
    { label: cpiUp ? "CPI 재상승" : "CPI 둔화", tone: cpiUp ? "warn" : "ok" },
    { label: cutHopeLow ? "금리인하 기대 감소" : "금리인하 기대 유지", tone: cutHopeLow ? "warn" : "ok" },
    { label: hawkish ? "연준 매파 발언" : "연준 중립", tone: hawkish ? "warn" : "ok" },
    { label: recessionLow ? "경기침체 우려 낮음" : "경기 둔화 주의", tone: recessionLow ? "ok" : "warn" },
  ]

  return {
    kind: /** @type {const} */ ("policy"),
    title: "정책 유동성",
    score,
    band,
    factors,
    contributions,
  }
}

/**
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot
 * @param {object | null | undefined} panicData
 * @returns {DualLiquidityReport}
 */
export function buildDualLiquidityReport(snapshot, panicData = null) {
  const market = buildMarketLiquidity(snapshot, panicData)
  const policy = buildPolicyLiquidity(snapshot)
  const actionMode = resolveLiquidityActionMode(market.score, policy.score)

  return {
    visible: market.score != null || policy.score != null,
    market,
    policy,
    marketScore: market.score,
    policyScore: policy.score,
    actionMode,
  }
}
