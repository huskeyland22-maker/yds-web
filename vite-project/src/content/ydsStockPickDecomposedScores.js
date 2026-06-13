/**
 * 종목추천 5축 점수 분해 (0~100) — 종합 = 가중 평균
 */

import { isDevMode, isShowDebugPanel } from "../utils/devMode.js"

/** @typedef {'performance' | 'technology' | 'momentum' | 'sector' | 'marketEnv'} DecomposedScoreKey */

export const DECOMPOSED_SCORE_WEIGHTS = {
  performance: 0.2,
  technology: 0.2,
  momentum: 0.2,
  sector: 0.2,
  marketEnv: 0.2,
}

export const DECOMPOSED_SCORE_LABELS = {
  performance: "실적",
  technology: "기술",
  momentum: "모멘텀",
  sector: "섹터",
  marketEnv: "시장환경",
}

/** @param {number} n @param {number} lo @param {number} hi */
function clamp(n, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

/** @param {number} value @param {number} max */
function scaleTo100(value, max) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0
  return clamp((value / max) * 100)
}

/**
 * @typedef {{
 *   performance: number
 *   technology: number
 *   momentum: number
 *   sector: number
 *   marketEnv: number
 *   total: number
 *   rows: { key: DecomposedScoreKey; label: string; value: number; weight: number; weightPct: number }[]
 *   debug: Record<string, unknown>
 * }} DecomposedStockScores
 */

/**
 * @param {{
 *   rating?: number
 *   marketFitScore?: number
 *   scores?: { trendScore?: number; volumeScore?: number; positionScore?: number; marketFitScore?: number }
 *   scoreMeta?: object
 *   marketFitSource?: string
 *   ticker?: string
 *   name?: string
 * }} input
 * @returns {DecomposedStockScores}
 */
export function computeDecomposedStockScores(input) {
  const rating = Number(input.rating)
  const ratingNorm = Number.isFinite(rating) ? clamp((rating / 5) * 100) : 60
  const manualMarketFit = Number(input.marketFitScore)
  const manualFit100 = scaleTo100(manualMarketFit, 20)

  const trend = Number(input.scores?.trendScore) || 0
  const volume = Number(input.scores?.volumeScore) || 0
  const position = Number(input.scores?.positionScore) || 0
  const liveMarketFit = Number(input.scores?.marketFitScore) || 0
  const marketFit100 = scaleTo100(liveMarketFit, 20)

  const trend100 = scaleTo100(trend, 40)
  const volume100 = scaleTo100(volume, 20)
  const position100 = scaleTo100(position, 20)

  const performance = clamp(ratingNorm * 0.55 + manualFit100 * 0.45)
  const technology = clamp(position100 * 0.45 + trend100 * 0.55)
  const momentum = clamp(trend100 * 0.6 + volume100 * 0.4)
  const sector = clamp(marketFit100 * 0.65 + ratingNorm * 0.35)
  const marketEnv = clamp(marketFit100 * 0.7 + volume100 * 0.15 + trend100 * 0.15)

  const subs = { performance, technology, momentum, sector, marketEnv }

  const total = clamp(
    Object.entries(DECOMPOSED_SCORE_WEIGHTS).reduce(
      (sum, [key, weight]) => sum + subs[key] * weight,
      0,
    ),
  )

  const rows = /** @type {DecomposedStockScores['rows']} */ (
    Object.entries(DECOMPOSED_SCORE_LABELS).map(([key, label]) => ({
      key: /** @type {DecomposedScoreKey} */ (key),
      label,
      value: subs[key],
      weight: DECOMPOSED_SCORE_WEIGHTS[key],
      weightPct: Math.round(DECOMPOSED_SCORE_WEIGHTS[key] * 100),
    }))
  )

  const debug = {
    ticker: input.ticker ?? null,
    name: input.name ?? null,
    formula: "total = Σ(하위점수 × 20%)",
    weights: DECOMPOSED_SCORE_WEIGHTS,
    inputs: {
      rating,
      ratingNorm,
      manualMarketFit,
      manualFit100,
      trend,
      volume,
      position,
      liveMarketFit,
      trend100,
      volume100,
      position100,
      marketFit100,
      marketFitSource: input.marketFitSource ?? null,
    },
    subs,
    total,
    legacySum: trend + volume + position + liveMarketFit,
  }

  return { ...subs, total, rows, debug }
}

/** @returns {boolean} */
export function isStockPickScoreDebugEnabled() {
  return isDevMode() && isShowDebugPanel()
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 */
export function logDecomposedScoreDebug(stock) {
  if (!isStockPickScoreDebugEnabled() || typeof console === "undefined") return
  if (!stock?.decomposedScores?.debug) return

  console.groupCollapsed(
    `[stock-pick-score] ${stock.ticker} ${stock.name} · 종합 ${stock.decomposedScores.total}`,
  )
  console.table(
    Object.fromEntries(
      stock.decomposedScores.rows.map((r) => [r.label, { 점수: r.value, 가중: `${r.weightPct}%` }]),
    ),
  )
  console.info("계산 입력", stock.decomposedScores.debug.inputs)
  console.info("레거시 4축", stock.scores)
  console.groupEnd()
}
