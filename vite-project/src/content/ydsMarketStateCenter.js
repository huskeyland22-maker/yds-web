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
  },
  boundary: {
    strategy: "비중 점검 · 신규 진입 축소",
    actions: ["탐욕 확대 주의", "추격 자제", "현금 유지"],
    pickLimit: 10,
    pickLimitLabel: "TOP10",
    headline: "경계 구간 — 선별적 관찰",
  },
  adjustment: {
    strategy: "관심 종목 발굴",
    actions: ["관심 종목 발굴", "현금 유지", "추격 금지"],
    pickLimit: 20,
    pickLimitLabel: "TOP20",
    headline: "조정 구간 — 유망 종목 탐색",
  },
  fear: {
    strategy: "분할 준비 · 우량주 집중",
    actions: ["분할 매수 준비", "우량주 집중", "소량 접근"],
    pickLimit: 50,
    pickLimitLabel: "TOP50",
    headline: "위축 구간 — 우량주 집중 매수",
  },
  panic: {
    strategy: "공격적 종목 발굴",
    actions: ["계획된 현금 투입", "우량주 집중", "분할 대응"],
    pickLimit: Infinity,
    pickLimitLabel: "전체",
    headline: "충격 구간 — 공격적 종목 발굴",
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
 */
export function resolveMarketStateCenterView(panicData) {
  const positionView = resolveMarketPositionView(panicData)
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
    pickLimit: strategyBlock.pickLimit,
    pickLimitLabel: strategyBlock.pickLimitLabel,
    panicScore: panicView?.score ?? null,
    panicRail: panicView?.rail ?? [],
    panicLabel: panicBand?.label ?? panicView?.currentLine ?? "—",
    panicEmoji: panicBand?.emoji ?? "—",
    macroId,
    buyIntensityPct,
    buyIntensityLabel: `매수 강도 ${buyIntensityPct}%`,
  }
}
