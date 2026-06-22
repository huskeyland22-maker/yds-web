/**
 * 유동성 환경 V3 — 시장 유동성 + 정책 유동성 (실측·규칙 기반)
 */

import { dxyInterestScore, pickDxyValue, pickUs10yValue, pickSnapshotMetricValue } from "../utils/macroTimingAuxScores.js"
import { buildPolicyLiquidityLane } from "./policyLiquidityEngine.js"

/** @typedef {'very_favorable'|'favorable'|'neutral'|'alert'|'danger'} LiquidityBandId */
/** @typedef {'ok'|'warn'} LiquidityFactorTone */

/**
 * @typedef {{
 *   label: string
 *   detail?: string
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
 *   environmentLabel: string
 *   environment: LiquidityFactorLine[]
 *   marketImpacts: string[]
 *   investmentLines: string[]
 *   laneActions: string[]
 *   contributions: LiquidityContributionRow[]
 * }} LiquidityLaneInterpretation
 */

/**
 * @typedef {{
 *   kind: 'market' | 'policy'
 *   title: string
 *   score: number | null
 *   band: LiquidityBand
 *   environmentLabel: string
 *   environment: LiquidityFactorLine[]
 *   marketImpacts: string[]
 *   investmentLines: string[]
 *   laneActions: string[]
 *   contributions: LiquidityContributionRow[]
 *   scoreExplain?: string
 * }} LiquidityLaneCard
 */

/**
 * @typedef {{
 *   headline: string
 *   lines: string[]
 *   leadSentence: string
 * }} LiquiditySynthesis
 */

/**
 * @typedef {{
 *   visible: boolean
 *   market: LiquidityLaneCard
 *   policy: LiquidityLaneCard
 *   marketScore: number | null
 *   policyScore: number | null
 *   actionMode: 'aggressive' | 'defense' | 'short_term' | 'medium_long' | 'balanced'
 *   synthesis: LiquiditySynthesis
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
    if (score >= 40) return { id: "neutral", label: "중립~긴축", tone: "neutral" }
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

/**
 * 시장·정책 유동성 점수 비교 → 종합 해석 (유동성 카드 하단 · 행동 가이드 핵심 문장)
 * @param {number | null} market
 * @param {number | null} policy
 * @returns {LiquiditySynthesis}
 */
export function buildLiquiditySynthesis(market, policy) {
  const mode = resolveLiquidityActionMode(market, policy)

  if (mode === "aggressive") {
    return {
      headline: "시장·정책 유동성 동시 우호",
      lines: ["유동성과 정책이 동시에 우호적", "공격적 투자 환경"],
      leadSentence: "유동성·정책 동시 우호 — 공격적 투자 환경",
    }
  }
  if (mode === "defense") {
    return {
      headline: "시장·정책 유동성 동시 약세",
      lines: ["유동성과 정책 모두 비우호", "방어 중심 접근 필요"],
      leadSentence: "유동성·정책 모두 비우호 — 방어 중심 접근",
    }
  }
  if (mode === "short_term") {
    return {
      headline: "시장 유동성 > 정책 유동성",
      lines: [
        "현재 시장은 정책보다 자금 흐름이 강한 상태",
        "단기 상승은 가능하지만",
        "정책 지원은 제한적",
      ],
      leadSentence: "시장이 정책보다 강함 — 단기 상승 가능, 정책 지원은 제한적",
    }
  }
  if (mode === "medium_long") {
    return {
      headline: "정책 유동성 > 시장 유동성",
      lines: [
        "현재 자금 흐름은 약하지만",
        "정책 완화 기대가 높은 상태",
        "중장기 개선 가능성 존재",
      ],
      leadSentence: "자금 흐름은 약하나 정책 완화 기대 높음 — 중장기 개선 여지",
    }
  }

  return {
    headline: "시장·정책 유동성 균형",
    lines: [
      "시장 자금 흐름과 정책 기조가 비슷한 수준",
      "선별적 접근 유지",
      "급격한 포지션 변경은 지양",
    ],
    leadSentence: "시장·정책 유동성 균형 — 선별적 접근 유지",
  }
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

/** @param {number | null} score */
function buildMarketImpacts(score) {
  const s = score ?? 50
  if (s >= 60) {
    return [
      "위험자산 선호 유지",
      "성장주 자금 유입 지속",
      "신용시장 안정",
      "주식시장 수급 우호",
    ]
  }
  if (s >= 40) {
    return ["선별적 위험자산 선호", "섹터·종목 차별화", "신용시장 혼조", "수급 중립"]
  }
  return ["위험자산 선호 약화", "성장주 자금 유출 우려", "신용시장 경계", "주식시장 수급 부담"]
}

/**
 * @param {number | null} marketScore
 * @param {number | null} policyScore
 */
function buildMarketInvestmentLines(marketScore, policyScore) {
  const m = marketScore ?? 50
  const p = policyScore ?? 50

  if (m > p + 5) {
    return [
      "현재는 정책 환경보다 실제 시장 자금 흐름이 강한 상태",
      "단기적으로는 위험자산 우위 환경 유지",
    ]
  }
  if (m < p - 5) {
    return [
      "현재는 시장 자금 흐름보다 정책 환경이 상대적으로 우호",
      "중장기 완화 기대는 있으나 단기 수급은 제한될 수 있음",
    ]
  }
  if (m >= 60) {
    return ["시장·정책 유동성이 균형적", "위험자산 우위 환경이 유지되는 국면"]
  }
  return ["시장·정책 유동성이 혼조", "선별적 접근이 필요한 국면"]
}

/**
 * @param {number | null} marketScore
 * @param {number | null} policyScore
 */
function buildPolicyInvestmentLines(marketScore, policyScore) {
  const m = marketScore ?? 50
  const p = policyScore ?? 50

  if (p < m - 5) {
    return [
      "현재는 시장 유동성보다 정책 환경이 약한 상태",
      "단기 상승은 가능하지만 멀티플 확장은 제한될 수 있음",
    ]
  }
  if (p > m + 5) {
    return [
      "현재는 시장 유동성보다 정책 완화 기대가 상대적으로 강함",
      "중장기 성장주 우위 환경으로 전환 여지",
    ]
  }
  if (p < 40) {
    return ["정책 환경이 시장에 부담", "방어적 포지셔닝이 유리할 수 있음"]
  }
  return ["정책·시장 유동성이 혼조", "실적·현금흐름 중심 접근이 유리"]
}

/** @param {number | null} marketScore @param {number | null} policyScore */
function buildMarketLaneActions(marketScore, policyScore) {
  const m = marketScore ?? 50
  const p = policyScore ?? 50

  if (m >= 60 && m > p + 5) {
    return ["관심종목 분할매수", "성장주 우위 유지", "추격매수는 자제"]
  }
  if (m < 40) {
    return ["신규 매수 축소", "현금 비중 점검", "방어주·현금 우선"]
  }
  return ["관심종목만 추적", "분할 접근 유지", "추격매수 자제"]
}

/** @param {number | null} policyScore @param {number | null} marketScore */
function buildPolicyLaneActions(policyScore, marketScore) {
  const p = policyScore ?? 50
  const m = marketScore ?? 50

  if (p < m - 5 && p < 55) {
    return ["분할매수 유지", "추격매수 자제", "실적 중심 접근"]
  }
  if (p >= 60) {
    return ["중장기 분할 접근 검토", "성장주 비중 점진 확대", "추격매수 자제"]
  }
  if (p < 40) {
    return ["매수 속도 조절", "현금 비중 확대", "고밸류·실적주 우선"]
  }
  return ["분할매수 유지", "추격매수 자제", "실적·현금흐름 점검"]
}

/** @param {LiquidityFactorLine[]} environment @param {number | null} score */
function buildMarketScoreExplain(environment, score) {
  const positives = environment
    .filter((f) => f.tone === "ok")
    .map((f) => f.label.replace("HY 스프레드 안정", "HY 스프레드 축소"))
  const negatives = environment.filter((f) => f.tone === "warn").map((f) => f.label)

  if (positives.length >= 2 && (score ?? 50) >= 55) {
  const joined =
      positives.length === 2
        ? `${positives[0]}과 ${positives[1]}`
        : `${positives.slice(0, -1).join(", ")}과 ${positives[positives.length - 1]}`
    return `현재 유동성은 ${joined}가 긍정적으로 작용하고 있습니다.`
  }

  if (negatives.length >= 2 && (score ?? 50) < 50) {
    const joined =
      negatives.length === 2
        ? `${negatives[0]}과 ${negatives[1]}`
        : `${negatives.slice(0, -1).join(", ")}과 ${negatives[negatives.length - 1]}`
    return `현재 유동성은 ${joined}가 부담으로 작용하고 있습니다.`
  }

  if (positives.length && negatives.length) {
    return `긍정 요인(${positives[0]})과 부담 요인(${negatives[0]})이 혼재해 선별적 접근이 필요합니다.`
  }

  if (positives.length) {
    return `현재 유동성은 ${positives[0]}이 시장에 우호적으로 작용하고 있습니다.`
  }

  if (negatives.length) {
    return `현재 유동성은 ${negatives[0]}이 시장 유동성을 제한하고 있습니다.`
  }

  return "시장 유동성 지표가 혼조입니다. 급격한 포지션 변경은 지양하세요."
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
  const environment = [
    { label: vixOk ? "VIX 안정" : "VIX 상승", tone: vixOk ? "ok" : "warn" },
    { label: hyOk ? "HY 스프레드 안정" : "HY 스프레드 확대", tone: hyOk ? "ok" : "warn" },
    { label: moveOk ? "채권 변동성 안정" : "채권 변동성 확대", tone: moveOk ? "ok" : "warn" },
    { label: dxyWarn ? "달러 강세" : "달러 중립", tone: dxyWarn ? "warn" : "ok" },
    { label: rateWarn ? "금리 부담" : "금리 안정", tone: rateWarn ? "warn" : "ok" },
  ]

  const scoreExplain = buildMarketScoreExplain(environment, score)

  return {
    kind: /** @type {const} */ ("market"),
    title: "시장 유동성",
    score,
    band,
    environmentLabel: "현재 시장 환경",
    environment,
    marketImpacts: buildMarketImpacts(score),
    investmentLines: [],
    laneActions: [],
    contributions,
    scoreExplain,
  }
}

/**
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot
 * @param {object | null | undefined} panicData
 * @param {Record<string, number[]>} [apiHistory]
 * @returns {DualLiquidityReport}
 */
export function buildDualLiquidityReport(snapshot, panicData = null, apiHistory = {}) {
  const market = buildMarketLiquidity(snapshot, panicData)
  const policy = buildPolicyLiquidityLane(snapshot, apiHistory)

  market.investmentLines = buildMarketInvestmentLines(market.score, policy.score)
  market.laneActions = buildMarketLaneActions(market.score, policy.score)
  policy.investmentLines = buildPolicyInvestmentLines(market.score, policy.score)
  policy.laneActions = buildPolicyLaneActions(policy.score, market.score)

  const actionMode = resolveLiquidityActionMode(market.score, policy.score)
  const synthesis = buildLiquiditySynthesis(market.score, policy.score)

  return {
    visible: market.score != null || policy.score != null,
    market,
    policy,
    marketScore: market.score,
    policyScore: policy.score,
    actionMode,
    synthesis,
  }
}
