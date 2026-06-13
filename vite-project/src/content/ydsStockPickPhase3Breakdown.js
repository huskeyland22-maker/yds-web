/**
 * Phase 3 — 6항목 점수 분해 (총 100점)
 * 기존 rating · marketFit · trend · volume · position 점수를 그대로 스케일링
 */

import { isDevMode, isShowDebugPanel } from "../utils/devMode.js"

/** @typedef {'performance' | 'industry' | 'sector' | 'marketEnv' | 'technical' | 'volume'} Phase3ScoreKey */

export const PHASE3_SCORE_COMPONENTS = [
  { id: "performance", label: "실적", max: 30 },
  { id: "industry", label: "산업", max: 25 },
  { id: "sector", label: "섹터", max: 20 },
  { id: "marketEnv", label: "시장환경", max: 15 },
  { id: "technical", label: "기술적분석", max: 5 },
  { id: "volume", label: "거래량", max: 5 },
]

export const PHASE3_QUALITY_MAX = 75
export const PHASE3_TIMING_MAX = 25

/** @param {number} n @param {number} lo @param {number} hi */
function clamp(n, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

/** @param {number} value @param {number} sourceMax @param {number} targetMax */
export function scaleToMax(value, sourceMax, targetMax) {
  if (!Number.isFinite(value) || !Number.isFinite(sourceMax) || sourceMax <= 0) return 0
  return clamp((value / sourceMax) * targetMax, 0, targetMax)
}

/**
 * @typedef {{
 *   performance: number
 *   industry: number
 *   sector: number
 *   marketEnv: number
 *   technical: number
 *   volume: number
 *   total: number
 *   quality: number
 *   timing: number
 *   rows: { key: Phase3ScoreKey; label: string; value: number; max: number; display: string }[]
 *   debug: Record<string, unknown>
 * }} Phase3ScoreBreakdown
 */

/**
 * @param {{
 *   rating?: number
 *   manualMarketFit?: number
 *   scores?: { trendScore?: number; volumeScore?: number; positionScore?: number; marketFitScore?: number }
 *   ticker?: string
 *   name?: string
 * }} input
 * @returns {Phase3ScoreBreakdown}
 */
export function computePhase3ScoreBreakdown(input) {
  const rating = Number(input.rating)
  const manualMarketFit = Number(input.manualMarketFit) || 0
  const trend = Number(input.scores?.trendScore) || 0
  const volumeScore = Number(input.scores?.volumeScore) || 0
  const position = Number(input.scores?.positionScore) || 0
  const liveMarketFit = Number(input.scores?.marketFitScore) || 0

  const performance = Number.isFinite(rating) ? clamp((rating / 5) * 30, 0, 30) : 18
  const industry = scaleToMax(manualMarketFit, 20, 25)
  const sector = scaleToMax(liveMarketFit, 20, 20)
  const marketEnv = scaleToMax(position, 20, 15)
  const technical = scaleToMax(trend, 40, 5)
  const volume = scaleToMax(volumeScore, 20, 5)

  const subs = { performance, industry, sector, marketEnv, technical, volume }
  const total = clamp(
    performance + industry + sector + marketEnv + technical + volume,
    0,
    100,
  )
  const quality = performance + industry + sector
  const timing = marketEnv + technical + volume

  const rows = PHASE3_SCORE_COMPONENTS.map((c) => ({
    key: /** @type {Phase3ScoreKey} */ (c.id),
    label: c.label,
    value: subs[c.id],
    max: c.max,
    display: `${subs[c.id]}/${c.max}`,
  }))

  const debug = {
    ticker: input.ticker ?? null,
    name: input.name ?? null,
    formula: "total = 실적+산업+섹터+시장환경+기술적분석+거래량",
    inputs: {
      rating,
      manualMarketFit,
      trend,
      volumeScore,
      position,
      liveMarketFit,
    },
    subs,
    quality,
    timing,
    total,
    legacySum: trend + volumeScore + position + liveMarketFit,
  }

  return { ...subs, total, quality, timing, rows, debug }
}

/** @returns {boolean} */
export function isPhase3ScoreDebugEnabled() {
  return isDevMode() && isShowDebugPanel()
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 */
export function logPhase3ScoreDebug(stock) {
  if (!isPhase3ScoreDebugEnabled() || typeof console === "undefined") return
  if (!stock?.scoreBreakdown?.debug) return

  console.groupCollapsed(
    `[stock-pick-phase3] ${stock.ticker} ${stock.name} · 종합 ${stock.scoreBreakdown.total}`,
  )
  console.table(
    Object.fromEntries(stock.scoreBreakdown.rows.map((r) => [r.label, r.display])),
  )
  console.info("품질/타이밍", {
    품질: `${stock.scoreBreakdown.quality}/${PHASE3_QUALITY_MAX}`,
    타이밍: `${stock.scoreBreakdown.timing}/${PHASE3_TIMING_MAX}`,
  })
  console.info("기술점수", stock.technicalScore)
  console.info("계산 입력", stock.scoreBreakdown.debug.inputs)
  console.groupEnd()
}
