/**
 * 시장 상태 V2 — 가격(60%) + 심리(30%) + 유동성(10%) 복합 엔진
 * 판단 순서: 가격 → 심리 → 유동성
 */

import { getFinalScore } from "../utils/tradingScores.js"
import {
  computeMarketPositionScore,
  resolveMarketPositionId,
  MARKET_POSITION_STAGES,
} from "./ydsMarketPositionEngine.js"
import {
  buildMarketStatePriceStructureReport,
  isPriceBearishStructure,
  isPriceBullishStructure,
  isPricePullbackInUptrend,
} from "./ydsMarketStatePriceStructure.js"
import { cycleCompositeLabel } from "./ydsMarketCycleFlow.js"

/** @typedef {import("./ydsMarketPositionEngine.js").MarketPositionId} MarketPositionId */

/** @type {Record<MarketPositionId, number>} */
const STAGE_SCORE_ANCHOR = {
  overheat: 85,
  boundary: 68,
  adjustment: 52,
  fear: 34,
  panic: 16,
}

/** @param {number} score */
function resolvePositionIdFromScore(score) {
  if (score >= 78) return "overheat"
  if (score >= 62) return "boundary"
  if (score >= 46) return "adjustment"
  if (score >= 28) return "fear"
  return "panic"
}

/**
 * @param {object | null | undefined} panicLike
 */
function computeSentimentStateScore(panicLike) {
  if (!panicLike) return 50
  const cnn = Number(panicLike.fearGreed)
  const vix = Number(panicLike.vix)
  const bofa = Number(panicLike.bofa)
  if (!Number.isFinite(cnn) && !Number.isFinite(vix)) return 50
  const id = resolveMarketPositionId(
    Number.isFinite(cnn) ? cnn : null,
    Number.isFinite(vix) ? vix : null,
    Number.isFinite(bofa) ? bofa : null,
  )
  return computeMarketPositionScore(
    Number.isFinite(cnn) ? cnn : null,
    Number.isFinite(vix) ? vix : null,
    Number.isFinite(bofa) ? bofa : null,
    id,
  )
}

/**
 * @param {import("../market-os/liquidityDualEngine.js").DualLiquidityReport | null | undefined} dualLiquidity
 * @param {object | null | undefined} panicData
 */
function computeLiquidityStateScore(dualLiquidity, panicData) {
  if (dualLiquidity) {
    const market = dualLiquidity.marketScore ?? 50
    const policy = dualLiquidity.policyScore ?? 50
    return Math.round(market * 0.65 + policy * 0.35)
  }
  const hy = Number(panicData?.highYield)
  if (Number.isFinite(hy)) {
    return Math.round(Math.max(0, Math.min(100, 100 - ((hy - 3) / 7) * 100)))
  }
  return 50
}

/**
 * @param {number | null | undefined} priceScore
 * @param {number | null | undefined} sentimentScore
 * @param {number | null | undefined} liquidityScore
 */
export function computeMarketStateCompositeScore(priceScore, sentimentScore, liquidityScore) {
  const p = priceScore ?? 50
  const s = sentimentScore ?? 50
  const l = liquidityScore ?? 50
  return Math.round(p * 0.6 + s * 0.3 + l * 0.1)
}

/**
 * @param {MarketPositionId} baseId
 * @param {import("./ydsMarketStatePriceStructure.js").MarketStatePriceStructureReport | null} price
 * @param {number} sentimentScore
 */
function applyPricePriorityGates(baseId, price, sentimentScore) {
  if (!price) return baseId

  const bearish = isPriceBearishStructure(price)
  const bullish = isPriceBullishStructure(price)
  const pullback = isPricePullbackInUptrend(price)
  const structScore = price.structureScore ?? 50

  if (baseId === "fear" || baseId === "panic") {
    if (bearish || pullback || structScore >= 38) return "adjustment"
    if (price.lowerHigh && (price.return5d ?? 0) < 0) return "adjustment"
    if (sentimentScore <= 35 && structScore > 20) return "adjustment"
    if ((price.ma60SlopePct ?? 0) > 0 && (price.return5d ?? 0) < 0) return "adjustment"
  }

  if (bearish) {
    if (baseId === "boundary" && sentimentScore < 55) return "adjustment"
  }

  if (pullback && (baseId === "overheat" || baseId === "boundary")) {
    return "adjustment"
  }

  if (bullish && (baseId === "overheat" || baseId === "boundary")) {
    if (structScore >= 65) return "boundary"
  }

  if (structScore >= 68 && baseId === "fear") return "adjustment"
  if (structScore <= 32 && baseId === "boundary") return "adjustment"

  return baseId
}

/**
 * @param {string} cycleLabel
 * @param {import("./ydsMarketStatePriceStructure.js").MarketStatePriceStructureReport | null} price
 */
export function applyPriceGatesToCycleLabel(cycleLabel, price) {
  const label = String(cycleLabel ?? "").trim()
  if (!label || !price) return label

  const bearish = isPriceBearishStructure(price)
  const bullish = isPriceBullishStructure(price)
  const pullback = isPricePullbackInUptrend(price)

  if (bearish && /회복/.test(label)) {
    const pos = label.replace(/회복.*$/, "").replace(/\(경고\)/, "") || "조정"
    return `${pos}안정`
  }

  if (pullback && /회복/.test(label)) {
    return "조정안정"
  }

  if (pullback && /위축|충격/.test(label)) {
    return "조정안정"
  }

  if (bullish && /과열|경계약화/.test(label)) {
    if ((price.structureScore ?? 0) >= 62) return "상승확산"
    return "상승초기"
  }

  if (bullish && /조정회복/.test(label)) {
    return "상승초기"
  }

  return label
}

/**
 * @param {string} unifiedLabel
 * @param {import("./ydsMarketStatePriceStructure.js").MarketStatePriceStructureReport | null} price
 */
export function resolveMarketStateFinalConclusion(unifiedLabel, price) {
  const label = String(unifiedLabel ?? "").trim()
  if (pullbackConclusion(label, price)) return pullbackConclusion(label, price)
  if (/조정안정/.test(label) && price?.aboveMa60) {
    return "상승 종료가 아니라 상승 추세 내 조정 단계"
  }
  if (/조정회복/.test(label)) {
    return "조정 이후 회복 신호 — 분할 접근 검토 구간"
  }
  if (/상승초기|상승확산/.test(label)) {
    return "가격 구조가 상승 추세를 우선 시사"
  }
  if (/위축|충격/.test(label) && price && isPriceBearishStructure(price)) {
    return "심리 공포보다 가격 하락 구조가 우선 — 추격 자제"
  }
  return `${label} — 가격·심리·유동성 종합 판단`
}

/** @param {string} label @param {import("./ydsMarketStatePriceStructure.js").MarketStatePriceStructureReport | null} price */
function pullbackConclusion(label, price) {
  if (!price) return null
  if (/조정안정/.test(label) && isPricePullbackInUptrend(price)) {
    return "상승 종료가 아니라 상승 추세 내 조정 단계"
  }
  if (/조정안정/.test(label) && (price.lowerHigh || (price.return5d ?? 0) < 0)) {
    return "단기 고점 이후 조정 — 추격매수보다 지지 확인"
  }
  return null
}

/**
 * @param {{
 *   panicData?: object | null
 *   etfContext?: { qqqPrices?: Record<string, number>; spyPrices?: Record<string, number>; asOfDate?: string | null } | null
 *   dualLiquidity?: import("../market-os/liquidityDualEngine.js").DualLiquidityReport | null
 *   asOfDate?: string | null
 * }} input
 */
export function buildMarketStateCompositeReport(input = {}) {
  const { panicData, etfContext, dualLiquidity } = input
  const asOfDate = input.asOfDate ?? etfContext?.asOfDate ?? null

  const priceReport = buildMarketStatePriceStructureReport({
    qqqPrices: etfContext?.qqqPrices,
    spyPrices: etfContext?.spyPrices,
    asOfDate,
  })

  const sentimentScore = computeSentimentStateScore(panicData)
  const liquidityScore = computeLiquidityStateScore(dualLiquidity, panicData)
  const priceScore = priceReport?.structureScore ?? null

  const compositeScore = computeMarketStateCompositeScore(priceScore, sentimentScore, liquidityScore)
  const rawPositionId = resolvePositionIdFromScore(compositeScore)
  const positionId = applyPricePriorityGates(rawPositionId, priceReport, sentimentScore)

  const stage = MARKET_POSITION_STAGES.find((s) => s.id === positionId) ?? MARKET_POSITION_STAGES[2]
  const panicScore = panicData ? Math.round(getFinalScore(panicData) ?? NaN) : null

  /** @type {string[]} */
  const priceBullets = priceReport?.bullets?.slice(0, 6) ?? []
  /** @type {string[]} */
  const sentimentNotes = []
  if (Number.isFinite(panicScore)) {
    sentimentNotes.push(`심리 점수 ${panicScore} (보조)`)
  }
  if (Number.isFinite(liquidityScore)) {
    sentimentNotes.push(`유동성 ${liquidityScore} (10%)`)
  }

  return {
    visible: Boolean(panicData || priceReport),
    compositeScore,
    priceScore,
    sentimentScore,
    liquidityScore,
    positionId,
    stage,
    priceReport,
    priceBullets,
    sentimentNotes,
    weights: { price: 0.6, sentiment: 0.3, liquidity: 0.1 },
    hasPriceData: Boolean(priceReport),
    priceBearish: isPriceBearishStructure(priceReport),
    priceBullish: isPriceBullishStructure(priceReport),
    pricePullback: isPricePullbackInUptrend(priceReport),
  }
}

/**
 * @param {object} row
 * @param {Record<string, number> | null | undefined} qqqPrices
 * @param {Record<string, number> | null | undefined} spyPrices
 */
export function buildCompositeEntryFromRow(row, qqqPrices, spyPrices) {
  if (!row?.date) return null
  const date = String(row.date).slice(0, 10)
  const priceReport = buildMarketStatePriceStructureReport({
    qqqPrices,
    spyPrices,
    asOfDate: date,
  })
  const sentimentScore = computeSentimentStateScore(row)
  const compositeScore = computeMarketStateCompositeScore(
    priceReport?.structureScore ?? null,
    sentimentScore,
    50,
  )
  const rawId = resolvePositionIdFromScore(compositeScore)
  const positionId = applyPricePriorityGates(rawId, priceReport, sentimentScore)
  return {
    date,
    positionId,
    score: compositeScore,
    priceReport,
  }
}

/**
 * @param {string} unifiedLabel
 * @param {ReturnType<typeof buildMarketStateCompositeReport>} composite
 */
export function buildMarketStateRationaleReport(unifiedLabel, composite) {
  const label = String(unifiedLabel ?? "—").trim()
  const priceBullets = composite?.priceBullets ?? []
  const conclusion = resolveMarketStateFinalConclusion(label, composite?.priceReport ?? null)

  return {
    visible: priceBullets.length > 0 || Boolean(composite?.visible),
    unifiedLabel: label,
    priceBullets,
    sentimentNotes: composite?.sentimentNotes ?? [],
    conclusion,
    compositeScore: composite?.compositeScore ?? null,
    weights: composite?.weights ?? { price: 0.6, sentiment: 0.3, liquidity: 0.1 },
  }
}

export { STAGE_SCORE_ANCHOR, cycleCompositeLabel }
