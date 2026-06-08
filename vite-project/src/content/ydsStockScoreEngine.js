/**
 * YDS Phase 2-3 — 종목 점수 계산 엔진
 * 입력: 가격·거래량 스냅샷 (더미 또는 향후 API)
 * 시장 적합도는 외부에서 주입 (수동 → 향후 시장분석 연동)
 */

import { normalizeScoreBreakdown, YDS_SCORE_WEIGHTS } from "./ydsStockScoreConfig.js"

/**
 * @typedef {{
 *   close: number
 *   ma20: number
 *   ma60: number
 *   ma120: number
 *   high52w: number
 *   recentHigh: number
 *   volumeToday: number
 *   volumeAvg20: number
 * }} StockPriceSnapshot
 */

/**
 * @typedef {{
 *   ma20: number
 *   ma60: number
 *   ma120: number
 *   high52w: number
 *   volume: number
 *   position: number
 * }} TrendScoreDetail
 */

/**
 * @typedef {{
 *   ratio: number
 *   volume: number
 *   position: number
 *   marketFit: number
 *   trend: TrendScoreDetail
 *   volumeRatio: number
 *   drawdownPct: number
 * }} StockScoreComputeMeta
 */

/** @param {number} n @param {number} min @param {number} max */
export function clampScore(n, min, max) {
  return Math.max(min, Math.min(max, Math.round(n)))
}

/**
 * 이동평균 위 여부 (최대 10점)
 * @param {number} close
 * @param {number} ma
 */
export function scoreMaAlignment(close, ma) {
  if (!Number.isFinite(close) || !Number.isFinite(ma) || ma <= 0) return 0
  const ratio = close / ma
  if (ratio >= 1) return 10
  if (ratio >= 0.97) return clampScore(((ratio - 0.97) / 0.03) * 10, 0, 10)
  if (ratio >= 0.93) return clampScore(((ratio - 0.93) / 0.04) * 6, 0, 6)
  return 0
}

/**
 * 52주 신고가 근접도 (최대 10점)
 * @param {number} close
 * @param {number} high52w
 */
export function scoreHigh52wProximity(close, high52w) {
  if (!Number.isFinite(close) || !Number.isFinite(high52w) || high52w <= 0) return 0
  const ratio = close / high52w
  if (ratio >= 0.98) return 10
  if (ratio >= 0.9) return clampScore(6 + ((ratio - 0.9) / 0.08) * 4, 0, 10)
  if (ratio >= 0.8) return clampScore(((ratio - 0.8) / 0.1) * 6, 0, 6)
  return clampScore(ratio / 0.8 * 3, 0, 3)
}

/**
 * 추세 점수 (40)
 * @param {StockPriceSnapshot} snapshot
 * @returns {{ score: number; detail: TrendScoreDetail }}
 */
export function calcTrendScore(snapshot) {
  const ma20 = scoreMaAlignment(snapshot.close, snapshot.ma20)
  const ma60 = scoreMaAlignment(snapshot.close, snapshot.ma60)
  const ma120 = scoreMaAlignment(snapshot.close, snapshot.ma120)
  const high52w = scoreHigh52wProximity(snapshot.close, snapshot.high52w)
  const score = clampScore(ma20 + ma60 + ma120 + high52w, 0, YDS_SCORE_WEIGHTS.trend)
  return {
    score,
    detail: { ma20, ma60, ma120, high52w },
  }
}

/**
 * 거래량 점수 (20) — 20일 평균 대비 증가율
 * @param {StockPriceSnapshot} snapshot
 */
export function calcVolumeScore(snapshot) {
  const avg = snapshot.volumeAvg20
  const today = snapshot.volumeToday
  if (!Number.isFinite(avg) || avg <= 0 || !Number.isFinite(today)) {
    return { score: 0, ratio: 0 }
  }
  const ratio = today / avg
  let score = 0
  if (ratio >= 1.6) score = 20
  else if (ratio >= 1.3) score = 16
  else if (ratio >= 1.1) score = 13
  else if (ratio >= 1.0) score = 11
  else if (ratio >= 0.9) score = 8
  else if (ratio >= 0.75) score = 5
  else score = clampScore(ratio / 0.75 * 5, 0, 5)
  return { score: clampScore(score, 0, YDS_SCORE_WEIGHTS.volume), ratio }
}

/**
 * 위치 점수 (20) — 최근 고점 대비 · 눌림 구간
 * @param {StockPriceSnapshot} snapshot
 */
export function calcPositionScore(snapshot) {
  const high = snapshot.recentHigh
  const close = snapshot.close
  if (!Number.isFinite(high) || high <= 0 || !Number.isFinite(close)) {
    return { score: 0, drawdownPct: 0 }
  }
  const ratio = close / high
  const drawdown = 1 - ratio
  const drawdownPct = Math.round(drawdown * 1000) / 10

  let score = 0
  if (drawdown <= 0.02) score = 11
  else if (drawdown <= 0.06) score = 14
  else if (drawdown <= 0.12) score = 20
  else if (drawdown <= 0.18) score = 17
  else if (drawdown <= 0.25) score = 12
  else if (drawdown <= 0.35) score = 7
  else score = 4

  return { score: clampScore(score, 0, YDS_SCORE_WEIGHTS.position), drawdownPct }
}

/**
 * @param {number | null | undefined} marketFitScore
 */
export function calcMarketFitScore(marketFitScore) {
  if (!Number.isFinite(marketFitScore)) return 0
  return clampScore(marketFitScore, 0, YDS_SCORE_WEIGHTS.marketFit)
}

/**
 * @param {StockPriceSnapshot} snapshot
 * @param {{ marketFitScore?: number | null }} [options]
 * @returns {{ scores: import("./ydsStockScoreConfig.js").YdsScoreBreakdown; meta: StockScoreComputeMeta }}
 */
export function computeStockScores(snapshot, options = {}) {
  const trend = calcTrendScore(snapshot)
  const volume = calcVolumeScore(snapshot)
  const position = calcPositionScore(snapshot)
  const marketFit = calcMarketFitScore(options.marketFitScore)

  const scores =
    normalizeScoreBreakdown({
      trendScore: trend.score,
      volumeScore: volume.score,
      positionScore: position.score,
      marketFitScore: marketFit,
    }) ?? {
      trendScore: 0,
      volumeScore: 0,
      positionScore: 0,
      marketFitScore: 0,
      totalScore: 0,
    }

  return {
    scores,
    meta: {
      trend: trend.detail,
      volumeRatio: volume.ratio,
      drawdownPct: position.drawdownPct,
      volume: volume.score,
      position: position.score,
      marketFit,
    },
  }
}
