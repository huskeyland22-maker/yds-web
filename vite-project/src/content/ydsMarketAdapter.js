/**
 * YDS Phase 2-7 — 시장분석 Read-Only Adapter
 * 시장분석 컴포넌트·UI·로직 수정 없음 · content/utils 레이어만 읽기
 */

import { resolveActionSignalView } from "./ydsActionSignalView.js"
import { resolveTodayActions } from "./ydsActionGuide.js"
import { resolveCurrentMarketView } from "./ydsCurrentMarketView.js"
import { resolveMarketStageSnapshot } from "./ydsMarketStageLabels.js"
import { resolveMarketCycleStage } from "./ydsMarketCycleDisplay.js"
import { resolveMarketState } from "./ydsStateEngine.js"
import { resolveMomentumLayer } from "./ydsMomentumLayer.js"
import { resolveMarketPosition, computeMarketPositionScore } from "./ydsMarketPositionEngine.js"
import { buildMarketCycleFlowReport } from "./ydsMarketCycleFlow.js"
import { resolveUnifiedMarketStateLabel } from "./ydsUnifiedMarketState.js"
import { getMarketStatePickLimit } from "./ydsMarketStateCenter.js"
import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import { getFinalScore } from "../utils/tradingScores.js"
import { clampScore } from "./ydsStockScoreEngine.js"
import { STOCK_STATUS_VIEWS } from "./ydsStockActionEngine.js"
import { YDS_SCORE_WEIGHTS } from "./ydsStockScoreConfig.js"

/** @typedef {import("./ydsStockActionEngine.js").StockActionStatusId} StockActionStatusId */
/** @typedef {import("../panic-v2/panicMacroV1Status.js").MacroV1StatusId} MacroV1StatusId */

/**
 * @typedef {{
 *   ready: boolean
 *   ydsScore: number | null
 *   macroId: MacroV1StatusId
 *   macroLabel: string
 *   macroEmoji: string
 *   panicBandId: string
 *   panicLabel: string
 *   strategyLabel: string
 *   strategyEmoji: string
 *   isDefensive: boolean
 *   marketLabel: string
 *   marketEmoji: string
 *   cycleStageId: string
 *   cycleLabel: string
 *   cycleEmoji: string
 *   marketStateId: string | null
 *   marketStateLabel: string | null
 *   marketPositionId: string | null
 *   marketPositionLabel: string | null
 *   marketPositionEmoji: string | null
 *   unifiedMarketStateLabel: string | null
 *   marketScore: number | null
 *   pickDisplayLimit: number
 *   contextLine: string
 * }} YdsMarketAdapterContext
 */

/** @type {YdsMarketAdapterContext} */
export const DEFAULT_MARKET_CONTEXT = {
  ready: false,
  ydsScore: null,
  macroId: "neutral",
  macroLabel: "공포 부족",
  macroEmoji: "🟢",
  panicBandId: "neutral",
  panicLabel: "공포 부족",
  strategyLabel: "공포 부족",
  strategyEmoji: "🟢",
  isDefensive: true,
  marketLabel: "—",
  marketEmoji: "—",
  cycleStageId: "normal",
  cycleLabel: "성장",
  cycleEmoji: "🟡",
  marketStateId: null,
  marketStateLabel: null,
  marketPositionId: null,
  marketPositionLabel: null,
  marketPositionEmoji: null,
  unifiedMarketStateLabel: null,
  marketScore: null,
  pickDisplayLimit: 20,
  contextLine: "",
}

/** @type {Record<MacroV1StatusId, Record<StockActionStatusId, number>>} */
const REGIME_ACTION_FIT = {
  overheated: { trend: 14, dip: 11, interest: 12, overheat: 5 },
  neutral: { trend: 18, dip: 10, interest: 12, overheat: 6 },
  interest: { trend: 14, dip: 16, interest: 18, overheat: 8 },
  dca: { trend: 12, dip: 18, interest: 15, overheat: 6 },
  panicBuy: { trend: 19, dip: 19, interest: 18, overheat: 14 },
}

/**
 * @param {object | null | undefined} panicData
 * @param {object[]} [historyRows]
 * @returns {YdsMarketAdapterContext}
 */
export function resolveMarketAdapterContext(panicData, historyRows = []) {
  if (!panicData) return { ...DEFAULT_MARKET_CONTEXT }

  const ydsScore = getFinalScore(panicData)
  if (!Number.isFinite(ydsScore)) return { ...DEFAULT_MARKET_CONTEXT }

  const rounded = Math.round(ydsScore)
  const snapshot = resolveMarketStageSnapshot(rounded)
  const momentum = resolveMomentumLayer(panicData, historyRows)
  const macro = resolveMacroV1Status(rounded)
  const actions = resolveTodayActions(rounded, momentum, panicData)
  const market = resolveCurrentMarketView(panicData, historyRows)
  const signal = resolveActionSignalView(panicData, historyRows)
  const state = resolveMarketState(panicData, historyRows, momentum)
  const cycle = resolveMarketCycleStage(panicData.fearGreed, panicData.bofa)
  const marketPosition = resolveMarketPosition(panicData)
  const cycleFlow =
    Array.isArray(historyRows) && historyRows.length > 0
      ? buildMarketCycleFlowReport(historyRows)
      : null
  const unifiedMarketStateLabel = resolveUnifiedMarketStateLabel(
    cycleFlow,
    marketPosition?.label ?? null,
  )
  const marketScore = marketPosition
    ? computeMarketPositionScore(
        marketPosition.cnn,
        marketPosition.vix,
        marketPosition.bofa,
        marketPosition.id,
      )
    : null

  const macroId = macro?.id ?? "neutral"
  const panicBandId = snapshot?.panic?.id ?? macroId

  const isDefensive =
    signal?.strategyLabel === "방어 모드" ||
    macroId === "overheated" ||
    macroId === "neutral" ||
    cycle?.id === "warning" ||
    cycle?.id === "cashPrep" ||
    cycle?.id === "partialCash"

  return {
    ready: true,
    ydsScore: Math.round(ydsScore),
    macroId,
    macroLabel: macro?.label ?? DEFAULT_MARKET_CONTEXT.macroLabel,
    macroEmoji: macro?.emoji ?? DEFAULT_MARKET_CONTEXT.macroEmoji,
    panicBandId,
    panicLabel: snapshot?.panic?.label ?? macro?.label ?? DEFAULT_MARKET_CONTEXT.panicLabel,
    strategyLabel: signal?.strategyLabel ?? market?.label ?? actions?.band?.label ?? DEFAULT_MARKET_CONTEXT.strategyLabel,
    strategyEmoji: signal?.strategyEmoji ?? actions?.band?.emoji ?? DEFAULT_MARKET_CONTEXT.strategyEmoji,
    isDefensive,
    marketLabel: market?.label ?? "—",
    marketEmoji: market?.emoji ?? "—",
    cycleStageId: cycle?.id ?? "normal",
    cycleLabel: cycle?.short ?? cycle?.label ?? "성장",
    cycleEmoji: cycle?.emoji ?? "🟡",
    marketStateId: state?.id ?? null,
    marketStateLabel: state?.label ?? null,
    marketPositionId: marketPosition?.id ?? null,
    marketPositionLabel: marketPosition?.label ?? null,
    marketPositionEmoji: marketPosition?.emoji ?? null,
    unifiedMarketStateLabel,
    marketScore,
    pickDisplayLimit: getMarketStatePickLimit(marketPosition?.id),
    contextLine: signal?.contextLine ?? market?.hint ?? "",
  }
}

/**
 * @param {YdsMarketAdapterContext} context
 * @param {StockActionStatusId} actionStatusId
 * @param {import("./ydsStockScoreConfig.js").YdsScoreBreakdown} scores
 */
export function computeMarketFitScore(context, actionStatusId, scores) {
  const table = REGIME_ACTION_FIT[context.macroId] ?? REGIME_ACTION_FIT.neutral
  let fit = table[actionStatusId] ?? 12

  if (context.isDefensive) {
    if (actionStatusId === "trend") fit += 1
    if (actionStatusId === "dip") fit -= 2
    if (actionStatusId === "overheat") fit -= 3
  }

  if (context.cycleStageId === "warning") {
    if (actionStatusId === "overheat") fit -= 3
    if (actionStatusId === "trend") fit -= 1
    if (actionStatusId === "dip") fit += 1
  } else if (context.cycleStageId === "cashPrep") {
    if (actionStatusId !== "dip") fit -= 2
    if (actionStatusId === "dip") fit += 1
  } else if (context.cycleStageId === "partialCash") {
    if (actionStatusId === "overheat") fit -= 4
    if (actionStatusId === "trend") fit -= 2
  }

  if (context.marketStateId === "recoveryProgress") {
    fit += 1
  }

  const trendRatio = scores.trendScore / YDS_SCORE_WEIGHTS.trend
  if (actionStatusId === "trend" && trendRatio >= 0.85) fit += 1
  if (actionStatusId === "dip" && scores.positionScore >= 14) fit += 1

  return clampScore(fit, 0, YDS_SCORE_WEIGHTS.marketFit)
}

/**
 * @param {YdsMarketAdapterContext} context
 * @param {StockActionStatusId} actionStatusId
 * @param {number} fitScore
 */
export function buildMarketFitReason(context, actionStatusId, fitScore) {
  if (fitScore < Math.round(YDS_SCORE_WEIGHTS.marketFit * 0.55)) return null

  const statusLabel = STOCK_STATUS_VIEWS[actionStatusId]?.label ?? "종목"

  if (fitScore >= Math.round(YDS_SCORE_WEIGHTS.marketFit * 0.8)) {
    if (context.isDefensive && actionStatusId === "trend") {
      return `${context.strategyLabel}에서 ${statusLabel}`
    }
    if (context.macroId === "dca" && actionStatusId === "dip") {
      return `${context.panicLabel} 구간 · ${statusLabel} 우대`
    }
    if (context.macroId === "panicBuy") {
      return `${context.panicLabel} · 시장 적합도 최대`
    }
    return `${context.panicLabel} · ${statusLabel} 적합`
  }

  return `현재 시장(${context.panicLabel})과 부분 적합`
}

/**
 * @param {YdsMarketAdapterContext} context
 * @param {StockActionStatusId} actionStatusId
 * @param {number} fitScore
 * @returns {import("./ydsStockRecommendReasons.js").RecommendReason[]}
 */
export function buildMarketFitReasons(context, actionStatusId, fitScore) {
  const detail = buildMarketFitReason(context, actionStatusId, fitScore)
  if (!detail) return []

  /** @type {import("./ydsStockRecommendReasons.js").RecommendReason[]} */
  const reasons = []
  if (fitScore >= Math.round(YDS_SCORE_WEIGHTS.marketFit * 0.55)) {
    reasons.push({
      id: "market-fit",
      emoji: "🟢",
      text: "현재 시장과 적합",
      tone: "positive",
    })
    if (detail !== "현재 시장과 적합") {
      reasons.push({
        id: "market-fit-detail",
        emoji: "🟢",
        text: detail,
        tone: "positive",
      })
    }
  }
  return reasons
}
