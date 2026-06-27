/**
 * YDS 메인 — 시장 상태 중심 철학
 * "지금 시장이 어디에 있는가?" (시장 상태) → "얼마나 살 것인가?" (패닉 강도 보조)
 */

import { resolveMarketPositionView } from "./ydsMarketPositionEngine.js"
import { resolvePanicActionView } from "./ydsPanicActionView.js"
import { resolvePanicBandForMacroStage } from "./ydsLanguage.js"
import { getFinalScore } from "../utils/tradingScores.js"

/** @typedef {import("./ydsMarketPositionEngine.js").MarketPositionId} MarketPositionId */
/** @typedef {import("../panic-v2/panicMacroV1Status.js").MacroV1StatusId} MacroV1StatusId */

/**
 * @typedef {{
 *   strategy: string
 *   actions: string[]
 *   pickLimit: number
 *   pickLimitLabel: string
 *   headline: string
 *   strategyPhase: string
 *   strategyNarrative: string[]
 * }} MarketStateStrategyView
 */

/** @type {Record<MarketPositionId, MarketStateStrategyView>} */
export const MARKET_STATE_STRATEGY = {
  overheat: {
    strategy: "현금 확보 · 추격 자제",
    actions: ["현금 비중 확대", "추격 금지", "익절·비중 점검"],
    pickLimit: 5,
    pickLimitLabel: "TOP5",
    headline: "과열 구간 — 핵심 종목만 관찰",
    strategyPhase: "현금 비중 확대 단계",
    strategyNarrative: [
      "과열 구간에서는 신규 추격보다",
      "현금 비중을 늘리고",
      "익절·리스크 점검에 집중하는 구간입니다.",
    ],
  },
  boundary: {
    strategy: "비중 점검 · 신규 진입 축소",
    actions: ["분할매도 검토", "추격 자제", "현금 유지"],
    pickLimit: 10,
    pickLimitLabel: "TOP10",
    headline: "경계 구간 — 선별적 관찰",
    strategyPhase: "분할매도 검토 단계",
    strategyNarrative: [
      "경계 구간에서는 수익 구간 비중을",
      "점검하고 분할 매도를 검토하며",
      "신규 진입은 보수적으로 운용합니다.",
    ],
  },
  adjustment: {
    strategy: "관심 종목 발굴",
    actions: ["관심 종목 발굴", "현금 유지", "추격 금지"],
    pickLimit: 20,
    pickLimitLabel: "TOP20",
    headline: "조정 구간 — 유망 종목 탐색",
    strategyPhase: "관심 종목 발굴 단계",
    strategyNarrative: [
      "성급한 추격 매수보다",
      "후보 종목을 관찰하며",
      "기회를 기다리는 구간입니다.",
    ],
  },
  fear: {
    strategy: "분할 준비 · 우량주 집중",
    actions: ["분할매수 시작", "우량주 집중", "소량 접근"],
    pickLimit: 50,
    pickLimitLabel: "TOP50",
    headline: "위축 구간 — 우량주 집중 매수",
    strategyPhase: "분할매수 시작 단계",
    strategyNarrative: [
      "공포 심리 확대 구간에서는",
      "우량주를 소량부터 분할 매수하며",
      "변동성에 대비하는 구간입니다.",
    ],
  },
  panic: {
    strategy: "공격적 종목 발굴",
    actions: ["적극매수 검토", "우량주 집중", "분할 대응"],
    pickLimit: Infinity,
    pickLimitLabel: "전체",
    headline: "충격 구간 — 공격적 종목 발굴",
    strategyPhase: "적극매수 검토 단계",
    strategyNarrative: [
      "극단적 위험회피 구간에서는",
      "계획된 현금 투입과 함께",
      "우량주 적극 매수를 검토하는 구간입니다.",
    ],
  },
}

/** @type {Record<MacroV1StatusId, number>} — 신규 투입 매수 강도 (%) */
export const PANIC_BUY_INTENSITY_PCT = {
  overheated: 0,
  neutral: 10,
  interest: 20,
  dca: 50,
  panicBuy: 80,
}

/**
 * @param {MarketPositionId | string | null | undefined} positionId
 * @returns {number}
 */
export function getMarketStatePickLimit(positionId) {
  const id = /** @type {MarketPositionId} */ (positionId ?? "adjustment")
  return MARKET_STATE_STRATEGY[id]?.pickLimit ?? MARKET_STATE_STRATEGY.adjustment.pickLimit
}

/**
 * @param {MacroV1StatusId | string | null | undefined} macroId
 * @returns {number}
 */
export function getPanicBuyIntensityPct(macroId) {
  const id = /** @type {MacroV1StatusId} */ (macroId ?? "neutral")
  return PANIC_BUY_INTENSITY_PCT[id] ?? PANIC_BUY_INTENSITY_PCT.neutral
}

/**
 * @param {object | null | undefined} panicData
 * @param {{
 *   etfContext?: { qqqPrices?: Record<string, number>; spyPrices?: Record<string, number>; asOfDate?: string | null } | null
 *   dualLiquidity?: import("../market-os/liquidityDualEngine.js").DualLiquidityReport | null
 * } | null} [context]
 */
export function resolveMarketStateCenterView(panicData, context = null) {
  const positionView = resolveMarketPositionView(panicData, context)
  if (!positionView) return null

  const ydsScore = panicData ? getFinalScore(panicData) : null
  const panicView =
    Number.isFinite(ydsScore) ? resolvePanicActionView(Math.round(/** @type {number} */ (ydsScore))) : null

  const positionId = positionView.position.id
  const strategyBlock = MARKET_STATE_STRATEGY[positionId] ?? MARKET_STATE_STRATEGY.adjustment
  const macroId = panicView?.currentStage?.id ?? "neutral"
  const panicBand = resolvePanicBandForMacroStage(macroId)
  const buyIntensityPct = getPanicBuyIntensityPct(macroId)

  return {
    position: positionView.position,
    positionScore: positionView.score,
    positionRail: positionView.rail,
    strategy: strategyBlock.strategy,
    actions: strategyBlock.actions,
    headline: strategyBlock.headline,
    strategyPhase: strategyBlock.strategyPhase,
    strategyNarrative: strategyBlock.strategyNarrative,
    pickLimit: strategyBlock.pickLimit,
    pickLimitLabel: strategyBlock.pickLimitLabel,
    panicScore: panicView?.score ?? null,
    panicRail: panicView?.rail ?? [],
    panicLabel: panicBand?.label ?? panicView?.currentLine ?? "—",
    panicEmoji: panicBand?.emoji ?? "—",
    macroId,
    buyIntensityPct,
    buyIntensityLabel: `매수 강도 ${buyIntensityPct}%`,
    composite: positionView.composite ?? null,
  }
}
