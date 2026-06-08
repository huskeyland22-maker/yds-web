/**
 * YDS Phase 2-4 — 점수 → 추천 이유 번역
 */

import { YDS_SCORE_WEIGHTS } from "./ydsStockScoreConfig.js"

/** @typedef {'positive' | 'neutral' | 'warning'} RecommendReasonTone */

/**
 * @typedef {{
 *   emoji: string
 *   text: string
 *   tone: RecommendReasonTone
 *   id: string
 * }} RecommendReason
 */

const THRESHOLDS = {
  trendHigh: Math.round(YDS_SCORE_WEIGHTS.trend * 0.75),
  trendMid: Math.round(YDS_SCORE_WEIGHTS.trend * 0.55),
  volumeHigh: Math.round(YDS_SCORE_WEIGHTS.volume * 0.7),
  volumeMid: Math.round(YDS_SCORE_WEIGHTS.volume * 0.55),
  positionHigh: Math.round(YDS_SCORE_WEIGHTS.position * 0.7),
  positionMid: Math.round(YDS_SCORE_WEIGHTS.position * 0.5),
  marketFitHigh: Math.round(YDS_SCORE_WEIGHTS.marketFit * 0.8),
}

/**
 * @param {import("./ydsStockScoreEngine.js").StockPriceSnapshot} [snapshot]
 */
function build52wProximityReason(snapshot) {
  if (!snapshot) return null
  const close = snapshot.close
  const high52w = snapshot.high52w
  if (!Number.isFinite(close) || !Number.isFinite(high52w) || high52w <= 0) return null
  const ratio = close / high52w
  if (ratio < 0.96) return null
  const gapPct = Math.max(0, Math.round((1 - ratio) * 100))
  return {
    id: "52w-near",
    emoji: "🟡",
    text: `52주 신고가 ${gapPct}% 이내`,
    tone: /** @type {const} */ ("neutral"),
  }
}

/**
 * @param {import("./ydsStockScoreConfig.js").YdsScoreBreakdown} scores
 * @param {import("./ydsStockScoreEngine.js").StockScoreComputeMeta} meta
 * @param {{
 *   limit?: number
 *   skipMarketFit?: boolean
 *   marketFitReasons?: RecommendReason[]
 *   engineSnapshot?: import("./ydsStockScoreEngine.js").StockPriceSnapshot
 * }} [options]
 * @returns {RecommendReason[]}
 */
export function buildRecommendReasons(scores, meta, options = {}) {
  const limit = options.limit ?? 3
  const skipMarketFit = options.skipMarketFit ?? false
  /** @type {RecommendReason[]} */
  const reasons = []
  const { trendScore, volumeScore, positionScore, marketFitScore } = scores
  const drawdownPct = meta.drawdownPct ?? 0
  const near52 = build52wProximityReason(options.engineSnapshot)

  if (trendScore >= THRESHOLDS.trendHigh) {
    reasons.push({ id: "trend-strong", emoji: "🟢", text: "강한 추세", tone: "positive" })
  } else if (trendScore >= THRESHOLDS.trendMid) {
    reasons.push({ id: "trend-ok", emoji: "🟡", text: "상승 추세 유지", tone: "neutral" })
  }

  if (volumeScore >= THRESHOLDS.volumeHigh) {
    reasons.push({ id: "volume-up", emoji: "🟢", text: "거래량 증가", tone: "positive" })
  } else if (volumeScore >= THRESHOLDS.volumeMid) {
    reasons.push({ id: "volume-ok", emoji: "🟡", text: "거래량 양호", tone: "neutral" })
  }

  if (near52) {
    reasons.push(near52)
  } else if (positionScore >= THRESHOLDS.positionHigh && drawdownPct <= 6) {
    reasons.push({ id: "near-high", emoji: "🟡", text: "신고가 근처", tone: "neutral" })
  } else if (positionScore >= THRESHOLDS.positionMid && drawdownPct >= 5) {
    reasons.push({ id: "pullback", emoji: "🟡", text: "눌림 구간", tone: "neutral" })
  }

  if (options.marketFitReasons?.length) {
    reasons.push(...options.marketFitReasons)
  } else if (!skipMarketFit && marketFitScore >= THRESHOLDS.marketFitHigh) {
    reasons.push({
      id: "market-fit",
      emoji: "🟢",
      text: "현재 시장과 적합",
      tone: "positive",
    })
  }

  return reasons.slice(0, limit)
}

/**
 * @param {RecommendReason[]} reasons
 * @returns {string}
 */
export function formatRecommendReasonSummary(reasons) {
  return reasons.map((r) => r.text).join(" · ")
}
