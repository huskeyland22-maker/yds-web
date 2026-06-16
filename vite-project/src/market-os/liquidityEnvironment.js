/**
 * 유동성 환경 V2 — 점수 기반 보조 필터
 * 10Y(40%) + Real Yield(30%) + HY OAS(20%) + MOVE(10%)
 */

/** @typedef {'favorable'|'neutral'|'alert'} LiquidityVerdictId */

/**
 * @typedef {{
 *   id: string
 *   label: string
 *   value: number | null
 *   display: string
 *   weight: number
 *   score: number | null
 * }} LiquidityMetricV2
 */

/**
 * @typedef {{
 *   id: LiquidityVerdictId
 *   label: string
 *   tone: 'favorable' | 'neutral' | 'alert'
 * }} LiquidityVerdict
 */

/**
 * @typedef {{
 *   score: number | null
 *   verdict: LiquidityVerdict
 *   summary: string
 *   headline: string
 *   styleSignal: string
 *   ratesSignal: string
 *   volatilitySignal: string
 *   creditSignal: string
 *   metrics: LiquidityMetricV2[]
 * }} LiquidityEnvironmentCard
 */

/** @type {Record<LiquidityVerdictId, LiquidityVerdict>} */
export const LIQUIDITY_VERDICTS = {
  favorable: { id: "favorable", label: "우호", tone: "favorable" },
  neutral: { id: "neutral", label: "중립", tone: "neutral" },
  alert: { id: "alert", label: "긴축", tone: "alert" },
}

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

/** @param {number | null} v */
function scoreUs10Y(v) {
  if (v == null) return null
  if (v <= 3.8) return 90
  if (v <= 4.2) return 75
  if (v <= 4.6) return 55
  if (v <= 5.0) return 35
  return 15
}

/** @param {number | null} v */
function scoreRealYield(v) {
  if (v == null) return null
  if (v <= 1.5) return 92
  if (v <= 1.9) return 75
  if (v <= 2.3) return 55
  if (v <= 2.7) return 35
  return 15
}

/** @param {number | null} v */
function scoreHyOas(v) {
  if (v == null) return null
  if (v <= 3.5) return 88
  if (v <= 4.2) return 70
  if (v <= 5.0) return 50
  if (v <= 5.8) return 30
  return 12
}

/** @param {number | null} v */
function scoreMove(v) {
  if (v == null) return null
  if (v <= 90) return 85
  if (v <= 105) return 68
  if (v <= 120) return 48
  if (v <= 135) return 30
  return 12
}

/** @param {LiquidityMetricV2[]} metrics */
function weightedLiquidityScore(metrics) {
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

/** @param {number | null} score */
export function resolveLiquidityVerdict(score) {
  if (score == null) return LIQUIDITY_VERDICTS.neutral
  if (score >= 60) return LIQUIDITY_VERDICTS.favorable
  if (score >= 40) return LIQUIDITY_VERDICTS.neutral
  return LIQUIDITY_VERDICTS.alert
}

/** @param {number | null} score */
function resolveLiquidityHeadline(score) {
  if (score == null) return "중립"
  if (score >= 80) return "매우 우호"
  if (score >= 60) return "우호"
  if (score >= 40) return "중립"
  if (score >= 20) return "긴축"
  return "매우 긴축"
}

/**
 * @param {LiquidityMetricV2[]} metrics
 * @param {LiquidityVerdict} verdict
 */
function buildLiquiditySummary(metrics, verdict) {
  const us10 = metrics.find((m) => m.id === "us10y")?.value
  const hy = metrics.find((m) => m.id === "hy")?.value
  const real = metrics.find((m) => m.id === "real")?.value

  if (verdict.id === "favorable") {
    if (us10 != null && us10 <= 4.2 && hy != null && hy <= 4.2) {
      return "금리 하락 + 신용 안정 · 유동성 우호 · 성장주 우세"
    }
    return "유동성 우호 · 위험자산 선호 환경"
  }

  if (verdict.id === "alert") {
    if (real != null && real >= 2.3 && hy != null && hy >= 5.0) {
      return "실질금리 부담 + 신용 스트레스 · 방어 우선"
    }
    return "유동성 경계 · 포지션 크기 보수 운영"
  }

  return "유동성 중립 · 선택적 종목 접근"
}

/**
 * @param {number | null} us10
 * @param {number | null} move
 * @param {number | null} real
 */
function buildRatesSignal(us10, move, real) {
  if (real != null && real >= 2.5) return "금리 부담"
  if (us10 != null && us10 >= 4.7 && move != null && move < 90) return "금리 안정"
  if (us10 != null && us10 <= 4.1) return "금리 우호"
  return "금리 안정"
}

/** @param {number | null} move */
function buildVolatilitySignal(move) {
  if (move == null) return "채권 변동성 중립"
  if (move < 90) return "채권 변동성 안정"
  if (move < 110) return "채권 변동성 보통"
  return "채권 변동성 불안"
}

/** @param {number | null} hy */
function buildCreditSignal(hy) {
  if (hy == null) return "신용 위험 중립"
  if (hy < 4) return "신용 위험 양호"
  if (hy < 5) return "신용 위험 보통"
  return "신용 위험 경계"
}

/**
 * @param {LiquidityVerdict} verdict
 * @param {number | null} real
 */
function buildStyleSignal(verdict, real) {
  if (real != null && real >= 2.5) return "가치주 방어"
  if (verdict.id === "favorable") return "성장주 우위"
  if (verdict.id === "alert") return "방어주 우위"
  return "종목 선별"
}

/**
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot
 * @param {object | null | undefined} panicData
 * @param {(key: string, n: number | null, fmt?: string) => string} formatValue
 * @returns {LiquidityEnvironmentCard}
 */
export function buildLiquidityEnvironmentCard(snapshot, panicData, formatValue) {
  const us10 = toNum(metricRow(snapshot, "US10Y")?.current)
  const real = toNum(metricRow(snapshot, "REAL_YIELD")?.current)
  const hy = toNum(panicData?.highYield ?? panicData?.hyOas)
  const move = toNum(panicData?.move ?? metricRow(snapshot, "MOVE")?.current)

  /** @type {LiquidityMetricV2[]} */
  const metrics = [
    {
      id: "us10y",
      label: "10Y",
      value: us10,
      display: formatValue("US10Y", us10, "rate"),
      weight: 0.4,
      score: scoreUs10Y(us10),
    },
    {
      id: "real",
      label: "Real Yield",
      value: real,
      display: formatValue("REAL_YIELD", real, "rate"),
      weight: 0.3,
      score: scoreRealYield(real),
    },
    {
      id: "hy",
      label: "HY OAS",
      value: hy,
      display: formatValue("HY_OAS", hy, "rate"),
      weight: 0.2,
      score: scoreHyOas(hy),
    },
    {
      id: "move",
      label: "MOVE",
      value: move,
      display: formatValue("MOVE", move, "index"),
      weight: 0.1,
      score: scoreMove(move),
    },
  ]

  const score = weightedLiquidityScore(metrics)
  const verdict = resolveLiquidityVerdict(score)
  const summary = buildLiquiditySummary(metrics, verdict)
  const headline = resolveLiquidityHeadline(score)
  const styleSignal = buildStyleSignal(verdict, real)
  const ratesSignal = buildRatesSignal(us10, move, real)
  const volatilitySignal = buildVolatilitySignal(move)
  const creditSignal = buildCreditSignal(hy)

  return {
    score,
    verdict,
    summary,
    headline,
    styleSignal,
    ratesSignal,
    volatilitySignal,
    creditSignal,
    metrics,
  }
}
