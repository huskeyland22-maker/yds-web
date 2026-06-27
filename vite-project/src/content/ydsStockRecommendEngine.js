/**
 * 종목 추천 엔진 — 6축 독립 점수 · 복합 추천점수 · 점수 기반 추천 이유
 */

/** @typedef {'marketFit' | 'technical' | 'earnings' | 'growth' | 'momentum' | 'risk'} RecommendEngineKey */

export const RECOMMEND_ENGINE_LABELS = {
  marketFit: "시장 적합도",
  technical: "기술적 점수",
  earnings: "실적 점수",
  growth: "성장성 점수",
  momentum: "AI/산업 모멘텀",
  risk: "리스크 점수",
}

/** 리스크는 낮을수록 좋음 — 복합점수에는 riskSafety(100-risk) 사용 */
export const RECOMMEND_ENGINE_WEIGHTS = {
  marketFit: 0.18,
  technical: 0.17,
  earnings: 0.18,
  growth: 0.17,
  momentum: 0.18,
  riskSafety: 0.12,
}

const REASON_MIN = 58
const REASON_MAX = 5

/** @param {number} n */
function clamp100(n) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

/** @param {number} value @param {number} max */
function scale100(value, max) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0
  return clamp100((value / max) * 100)
}

/** @type {Record<string, number>} */
const SECTOR_MOMENTUM_BIAS = {
  ai: 12,
  semi: 10,
  power: 6,
  nuclear: 5,
  robot: 8,
  defense: 4,
  infra: 3,
}

/**
 * @typedef {{
 *   key: RecommendEngineKey
 *   label: string
 *   score: number
 *   riskInverted?: boolean
 * }} RecommendEngineScoreRow
 */

/**
 * @typedef {{
 *   id: string
 *   key: RecommendEngineKey
 *   score: number
 *   text: string
 * }} RecommendEngineReason
 */

/**
 * @typedef {{
 *   scores: Record<RecommendEngineKey, number>
 *   rows: RecommendEngineScoreRow[]
 *   compositeScore: number
 *   riskSafety: number
 *   reasons: RecommendEngineReason[]
 *   rationales: import("./ydsStockPickRecommendRationale.js").RecommendRationale[]
 * }} RecommendEngineReport
 */

/**
 * @param {{
 *   ticker?: string
 *   sector?: string
 *   rating?: number
 *   scores?: { trendScore?: number; volumeScore?: number; positionScore?: number; marketFitScore?: number }
 *   scoreMeta?: { drawdownPct?: number }
 *   technicalScore?: { score?: number; checks?: { id: string; pass: boolean }[] }
 *   scoreBreakdown?: { performance?: number; industry?: number; sector?: number }
 *   timingScore?: { score?: number }
 *   engineSnapshot?: import("./ydsStockScoreEngine.js").StockPriceSnapshot
 *   statusId?: string
 *   marketFitReasons?: { text?: string }[]
 * }} input
 * @returns {RecommendEngineReport}
 */
export function computeRecommendEngineReport(input = {}) {
  const rating = Number(input.rating)
  const trend = Number(input.scores?.trendScore) || 0
  const volume = Number(input.scores?.volumeScore) || 0
  const position = Number(input.scores?.positionScore) || 0
  const marketFitRaw = Number(input.scores?.marketFitScore) || 0
  const drawdown = Number(input.scoreMeta?.drawdownPct) || 0
  const techRaw = Number(input.technicalScore?.score) || 0
  const perfPhase = Number(input.scoreBreakdown?.performance) || 0
  const industryPhase = Number(input.scoreBreakdown?.industry) || 0
  const sectorPhase = Number(input.scoreBreakdown?.sector) || 0
  const timing = Number(input.timingScore?.score) || 0
  const sector = String(input.sector ?? "").toLowerCase()
  const snapshot = input.engineSnapshot
  const statusId = String(input.statusId ?? "")

  const marketFit = clamp100(scale100(marketFitRaw, 20) * 0.55 + scale100(timing, 25) * 0.45)

  const technical = clamp100(
    scale100(techRaw, 10) * 0.55 +
      scale100(trend, 40) * 0.3 +
      scale100(position, 20) * 0.15,
  )

  const earnings = clamp100(
    (Number.isFinite(rating) ? (rating / 5) * 100 : 50) * 0.6 +
      scale100(perfPhase, 30) * 0.4,
  )

  const growth = clamp100(
    (Number.isFinite(rating) ? (rating / 5) * 100 : 50) * 0.45 +
      scale100(volume, 20) * 0.35 +
      scale100(trend, 40) * 0.2,
  )

  const sectorBias = SECTOR_MOMENTUM_BIAS[sector] ?? 0
  const momentum = clamp100(
    scale100(industryPhase, 25) * 0.35 +
      scale100(sectorPhase, 20) * 0.35 +
      scale100(trend, 40) * 0.2 +
      sectorBias,
  )

  let risk = 35
  if (statusId === "overheat") risk += 28
  if (drawdown >= 12) risk += 18
  else if (drawdown >= 8) risk += 10
  if (scale100(volume, 20) < 40 && scale100(trend, 40) < 45) risk += 12
  const rsiCheck = input.technicalScore?.checks?.find((c) => c.id === "rsi")
  if (rsiCheck && !rsiCheck.pass) risk += 15
  if (snapshot?.high52w > 0 && snapshot.close / snapshot.high52w < 0.82) risk += 8
  risk = clamp100(risk)

  const riskSafety = clamp100(100 - risk)

  /** @type {Record<RecommendEngineKey, number>} */
  const scores = {
    marketFit,
    technical,
    earnings,
    growth,
    momentum,
    risk,
  }

  const rows = /** @type {RecommendEngineScoreRow[]} */ (
    Object.entries(RECOMMEND_ENGINE_LABELS).map(([key, label]) => ({
      key: /** @type {RecommendEngineKey} */ (key),
      label,
      score: scores[key],
      riskInverted: key === "risk",
    }))
  )

  const compositeScore = clamp100(
    marketFit * RECOMMEND_ENGINE_WEIGHTS.marketFit +
      technical * RECOMMEND_ENGINE_WEIGHTS.technical +
      earnings * RECOMMEND_ENGINE_WEIGHTS.earnings +
      growth * RECOMMEND_ENGINE_WEIGHTS.growth +
      momentum * RECOMMEND_ENGINE_WEIGHTS.momentum +
      riskSafety * RECOMMEND_ENGINE_WEIGHTS.riskSafety,
  )

  const reasons = buildRecommendEngineReasons({
    scores,
    riskSafety,
    trend,
    volume,
    position,
    drawdown,
    sector,
    statusId,
    snapshot,
    technicalScore: input.technicalScore,
    marketFitReasons: input.marketFitReasons,
  })

  const rationales = reasons.map((r) => ({
    id: r.id,
    category: r.key,
    source: `recommendEngine.${r.key}`,
    score: r.score,
    max: 100,
    ratio: r.score / 100,
    text: r.text,
  }))

  return {
    scores,
    rows,
    compositeScore,
    riskSafety,
    reasons,
    rationales,
  }
}

/**
 * @param {object} ctx
 * @returns {RecommendEngineReason[]}
 */
function buildRecommendEngineReasons(ctx) {
  const { scores, trend, volume, sector, snapshot, technicalScore, marketFitReasons } = ctx
  /** @type {RecommendEngineReason[]} */
  const out = []

  const push = (key, score, text) => {
    if (score < REASON_MIN || out.length >= REASON_MAX) return
    out.push({
      id: `re-${key}-${out.length}`,
      key,
      score,
      text,
    })
  }

  if (marketFitReasons?.length) {
    for (const r of marketFitReasons) {
      const text = String(r.text ?? "").trim()
      if (text && out.length < REASON_MAX) {
        push("marketFit", scores.marketFit, text)
      }
    }
  } else if (scores.marketFit >= REASON_MIN) {
    push(
      "marketFit",
      scores.marketFit,
      scores.marketFit >= 75 ? "시장 상태와 적합" : "시장 적합도 양호",
    )
  }

  if (scores.earnings >= REASON_MIN) {
    push(
      "earnings",
      scores.earnings,
      scores.earnings >= 78 ? "실적 증가" : "실적 점수 양호",
    )
  }

  if (scores.momentum >= REASON_MIN) {
    const aiSectors = new Set(["ai", "semi", "power", "robot"])
    push(
      "momentum",
      scores.momentum,
      aiSectors.has(sector) && scores.momentum >= 70
        ? "AI 산업 모멘텀"
        : scores.momentum >= 75
          ? "산업 모멘텀 강세"
          : "섹터 모멘텀 양호",
    )
  }

  const high52Pass = technicalScore?.checks?.find((c) => c.id === "high52")?.pass
  const nearHigh =
    high52Pass ||
    (snapshot?.high52w > 0 && snapshot.close / snapshot.high52w >= 0.95)
  if (nearHigh && scores.technical >= REASON_MIN - 5) {
    push("technical", scores.technical, "신고가 추세")
  } else if (scores.technical >= REASON_MIN) {
    const ma20 = technicalScore?.checks?.find((c) => c.id === "ma20")?.pass
    push(
      "technical",
      scores.technical,
      ma20 ? "기술적 추세 우위" : "기술적 점수 양호",
    )
  }

  if (scores.growth >= REASON_MIN) {
    push(
      "growth",
      scores.growth,
      scores.growth >= 76 ? "성장성 우수" : "성장성 점수 양호",
    )
  }

  if (scale100(volume, 20) >= 65 && trend >= 22) {
    push("growth", scores.growth, "기관 수급 우위")
  }

  if (scores.risk <= 42 && ctx.riskSafety >= 58) {
    push("risk", ctx.riskSafety, "리스크 낮음")
  }

  return out.sort((a, b) => b.score - a.score).slice(0, REASON_MAX)
}

/**
 * TOP20 · 랭킹 정렬용 추천 점수
 * @param {{ recommendEngine?: RecommendEngineReport; v4Score?: { finalRankScore?: number } }} stock
 */
export function getRecommendEngineSortScore(stock) {
  const fromEngine = stock.recommendEngine?.compositeScore
  if (Number.isFinite(fromEngine)) return fromEngine
  return stock.v4Score?.finalRankScore ?? 0
}
