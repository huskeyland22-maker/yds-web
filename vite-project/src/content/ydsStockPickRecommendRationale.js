/**
 * 추천 근거 — Phase3·V4·라이브 점수 기반 (고정 문구·AI 생성 금지)
 */

/** @typedef {import("./ydsStockPickModel.js").StockPickView} StockPickView */

/** @typedef {'performance' | 'sectorMomentum' | 'marketFit' | 'timing'} RationaleCategory */

/**
 * @typedef {{
 *   id: string
 *   category: RationaleCategory
 *   source: string
 *   score: number
 *   max: number
 *   ratio: number
 *   text: string
 * }} RecommendRationale
 */

export const RATIONALE_MAX_ITEMS = 4
const MIN_RATIO = 0.5

/** @param {string} s */
function cap20(s) {
  const t = String(s ?? "").trim()
  if (t.length <= 20) return t
  return `${t.slice(0, 19)}…`
}

/**
 * @param {number} value
 * @param {number} max
 */
function ratioOf(value, max) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0
  return value / max
}

/**
 * @param {number} performance
 * @param {number} rating
 * @returns {RecommendRationale | null}
 */
function buildPerformanceRationale(performance, rating) {
  const max = 30
  const ratio = ratioOf(performance, max)
  if (ratio < MIN_RATIO) return null

  let text
  if (performance >= 24) text = cap20(`실적·품질 ${performance}점`)
  else if (Number.isFinite(rating) && rating >= 4) text = cap20(`등급 ${rating}★·실적 양호`)
  else text = cap20(`실적 ${performance}/${max}`)

  return {
    id: "performance",
    category: "performance",
    source: "phase3.performance",
    score: performance,
    max,
    ratio,
    text,
  }
}

/**
 * @param {number} industry
 * @param {number} sector
 * @param {number} trend
 * @param {number} volume
 * @returns {RecommendRationale | null}
 */
function buildSectorMomentumRationale(industry, sector, trend, volume) {
  const combined = industry + sector
  const max = 45
  const ratio = ratioOf(combined, max)
  if (ratio < MIN_RATIO && trend < 22 && volume < 11) return null

  let text
  if (industry >= 18) text = cap20(`산업 모멘텀 ${industry}점`)
  else if (sector >= 14) text = cap20(`섹터 강세 ${sector}점`)
  else if (trend >= 28) text = cap20(`추세 점수 ${Math.round(trend)}`)
  else if (volume >= 12) text = cap20(`거래량 ${Math.round(volume)}점`)
  else text = cap20(`산업·섹터 ${combined}점`)

  return {
    id: "sectorMomentum",
    category: "sectorMomentum",
    source: "phase3.industry+sector",
    score: combined,
    max,
    ratio: Math.max(ratio, ratioOf(trend, 40), ratioOf(volume, 20)),
    text,
  }
}

/**
 * @param {number} marketEnv
 * @param {number} marketFitScore
 * @param {string} [strategyLabel]
 * @returns {RecommendRationale | null}
 */
function buildMarketFitRationale(marketEnv, marketFitScore, strategyLabel) {
  const max = 15
  const ratio = Math.max(ratioOf(marketEnv, max), ratioOf(marketFitScore, 20))
  if (ratio < MIN_RATIO) return null

  let text
  if (marketEnv >= 12) text = cap20(`시장적합 ${marketEnv}/${max}`)
  else if (marketFitScore >= 14) text = cap20(`시장점수 ${Math.round(marketFitScore)}`)
  else if (strategyLabel) text = cap20(`시장·${strategyLabel.slice(0, 8)}`)
  else text = cap20(`시장적합 ${marketEnv}/${max}`)

  return {
    id: "marketFit",
    category: "marketFit",
    source: "phase3.marketEnv",
    score: marketEnv,
    max,
    ratio,
    text,
  }
}

/**
 * @param {number} timing
 * @param {string} [timingGrade]
 * @returns {RecommendRationale | null}
 */
function buildTimingRationale(timing, timingGrade) {
  const max = 25
  const ratio = ratioOf(timing, max)
  if (ratio < MIN_RATIO) return null

  const grade = timingGrade && timingGrade !== "—" ? timingGrade : null
  let text
  if (timing >= 20 && grade) text = cap20(`타이밍 ${grade}·${timing}점`)
  else if (timing >= 16) text = cap20(`타이밍 양호 ${timing}점`)
  else text = cap20(`타이밍 ${timing}/${max}`)

  return {
    id: "timing",
    category: "timing",
    source: "timingScore.score",
    score: timing,
    max,
    ratio,
    text,
  }
}

/**
 * @param {StockPickView} stock
 * @param {{ strategyLabel?: string }} [opts]
 * @returns {RecommendRationale[]}
 */
export function buildRecommendRationales(stock, opts = {}) {
  const breakdown = stock.scoreBreakdown
  const performance = Number(breakdown?.performance) || 0
  const industry = Number(breakdown?.industry) || 0
  const sector = Number(breakdown?.sector) || 0
  const marketEnv = Number(breakdown?.marketEnv) || 0
  const timing = Number(breakdown?.timing ?? stock.timingScore?.score) || 0
  const trend = Number(stock.scores?.trendScore) || 0
  const volume = Number(stock.scores?.volumeScore) || 0
  const marketFitScore = Number(stock.scores?.marketFitScore) || 0
  const timingGrade = stock.v4Score?.timingGrade ?? "—"
  const rating = Number(stock.rating) || 0
  const strategyLabel = opts.strategyLabel ?? stock.pickMeta?.strategyLabel

  /** @type {(RecommendRationale | null)[]} */
  const candidates = [
    buildPerformanceRationale(performance, rating),
    buildSectorMomentumRationale(industry, sector, trend, volume),
    buildMarketFitRationale(marketEnv, marketFitScore, strategyLabel),
    buildTimingRationale(timing, timingGrade),
  ]

  return candidates
    .filter(Boolean)
    .sort((a, b) => b.ratio - a.ratio || b.score - a.score)
    .slice(0, RATIONALE_MAX_ITEMS)
}

/**
 * 성과검증 스냅샷용 — 근거 id·카테고리·점수만 잠금
 * @param {RecommendRationale[]} items
 */
export function serializeRationalesForSnapshot(items) {
  return items.map((r) => ({
    id: r.id,
    category: r.category,
    source: r.source,
    score: r.score,
    max: r.max,
    text: r.text,
  }))
}
