/**
 * 시장 상태 엔진 → 종목 엔진 연결 (우선순위·패닉 레짐·단계 이력)
 */

import { buildHomeV5CoreSynthesis } from "../home-v5/homeV5CoreSynthesis.js"
import { resolveHomeV5StrategyRegime } from "../home-v5/homeV5StrategyRegime.js"
import { buildTradingConfidenceBreakdown } from "./tradingZoneConfidenceEngine.js"
import {
  formatStageHistoryChipLabel,
  formatStageHistoryLog,
} from "./tradingZoneStageHistory.js"
import { TRADING_STAGE_META } from "./tacticalTradingZoneData.js"

/** @typedef {import("./tacticalTradingZoneData.js").TradingZonePosition} TradingZonePosition */
/** @typedef {import("./tacticalTradingZoneData.js").TradingStageId} TradingStageId */
/** @typedef {import("./tacticalTradingZoneData.js").TradingMarketId} TradingMarketId */
/** @typedef {import("./marketPolicyEngine.js").MarketState} MarketState */

/** @typedef {{
 *   id: string
 *   symbol: string
 *   stage: TradingStageId
 *   stageLabel: string
 *   score: number
 *   confidence: number
 *   confidenceLevel: string
 *   stagePath: string
 *   pathSegments: { dateLabel: string; stage: TradingStageId; label: string }[]
 *   stageLadder: string[]
 *   reasons: string[]
 *   confidenceBar: string
 *   regimeBoost: boolean
 * }} MarketLinkedStockPriority */

/** @typedef {{
 *   ready: boolean
 *   marketHeadline: string
 *   actionLead: string
 *   focusStage: TradingStageId
 *   focusLabel: string
 *   regimeId: string | null
 *   regimeLabel: string | null
 *   priorities: MarketLinkedStockPriority[]
 * }} MarketStockBridgeModel */

/** @type {Record<string, string>} */
const SYMBOL_SECTOR_THEME = {
  NVDA: "AI",
  AVGO: "반도체",
  META: "AI",
  SMH: "반도체",
  SOXL: "반도체",
  PLTR: "AI",
  TSLA: "성장",
  TSLL: "레버리지",
  TQQQ: "레버리지",
  "실리콘투": "반도체",
}

/** @type {Record<TradingStageId, string>} */
const STAGE_LADDER_SHORT = {
  interest: "관심",
  pullback: "눌림",
  trend: "추세",
  takeProfit: "익절",
  risk: "리스크",
}

/** @type {Record<string, string[]>} */
const REGIME_SYMBOL_BOOST = {
  neutral: ["SMH", "META", "PLTR", "NVDA"],
  interest: ["PLTR", "META", "NVDA", "TSLA"],
  pullback: ["SMH", "SOXL", "AVGO", "META"],
  trend: ["NVDA", "SMH", "실리콘투"],
  dca: ["SOXL", "TSLL", "TQQQ", "SMH"],
  panicBuy: ["SOXL", "TSLL", "TQQQ", "SMH"],
  overheated: ["META", "NVDA"],
}

/** @type {Record<MarketState, TradingStageId>} */
const MARKET_STATE_FOCUS = {
  panic: "interest",
  overheat: "pullback",
  pullback: "pullback",
  caution: "pullback",
  neutral: "interest",
}

/** @type {Record<TradingStageId, string>} */
const FOCUS_LABEL = {
  interest: "관심종목 우선",
  pullback: "눌림종목 우선",
  trend: "추세종목 우선",
  takeProfit: "익절·비중 축소 우선",
  risk: "리스크 축소 우선",
}

/** @type {Record<string, string>} */
const REGIME_LABEL = {
  neutral: "중립구간",
  interest: "관심구간",
  dca: "분할매수 구간",
  panicBuy: "패닉매수 구간",
  overheated: "과열구간",
}

/**
 * @param {number} score
 */
export function resolveConfidenceLevel(score) {
  if (score >= 85) return "높음"
  if (score >= 68) return "보통"
  return "낮음"
}

/**
 * @param {number} score 0–100
 * @param {number} [blocks]
 */
export function formatConfidenceBlockBar(score, blocks = 10) {
  const n = Math.max(0, Math.min(blocks, Math.round((Number(score) || 0) / (100 / blocks))))
  return `${"█".repeat(n)}${"░".repeat(blocks - n)}`
}

/**
 * @param {{ stage: TradingStageId; label?: string }[]} segments
 * @returns {string[]}
 */
export function buildCompactStageLadder(segments) {
  if (!segments?.length) return []
  /** @type {string[]} */
  const ladder = []
  let prev = ""
  for (const seg of segments) {
    const short = STAGE_LADDER_SHORT[seg.stage] ?? seg.label ?? seg.stage
    if (short && short !== prev) {
      ladder.push(short)
      prev = short
    }
  }
  return ladder
}

/**
 * @param {TradingZonePosition} position
 * @param {import("./tradingZoneStockEvaluation.js").TradingZoneStockEvaluation | undefined} ev
 * @param {{ regimeBoost: boolean; focusStage: TradingStageId }} ctx
 */
function buildPriorityReasons(position, ev, ctx) {
  /** @type {string[]} */
  const reasons = []

  if (ev?.dataReady && ev.strengthHighlights?.length) {
    reasons.push(...ev.strengthHighlights)
  }
  if (ev?.dataReady && ev.entryRationale?.length) {
    for (const line of ev.entryRationale) {
      if (!reasons.includes(line)) reasons.push(line)
    }
  }

  if (position.stage === "trend" || position.stage === "pullback") {
    if (!reasons.some((r) => /추세/.test(r))) reasons.push("추세 유지")
  } else if (position.stage === "interest" && !reasons.length) {
    reasons.push("관심 구간")
  }

  const histLen = position.stageHistory?.length ?? 0
  if (histLen >= 2 && !reasons.some((r) => /거래량/.test(r))) {
    reasons.push("거래량 증가")
  } else if (histLen <= 1 && !reasons.some((r) => /거래량/.test(r))) {
    reasons.push("거래량 점검")
  }

  const theme = SYMBOL_SECTOR_THEME[position.symbol]
  if (theme) {
    const sectorLine = `${theme} 섹터 강세`
    if (!reasons.includes(sectorLine)) reasons.push(sectorLine)
  } else if (ctx.regimeBoost) {
    reasons.push("패닉지수 연계 우선")
  }

  if (position.stage === ctx.focusStage) {
    const match = `${TRADING_STAGE_META[position.stage]?.label ?? position.stage} 구간 일치`
    if (!reasons.includes(match)) reasons.push(match)
  }

  if (ev?.dataReady && ev.riskFactors?.length) {
    const warn = ev.riskFactors[0]
    if (warn && !reasons.includes(warn)) reasons.push(`⚠ ${warn}`)
  }

  return [...new Set(reasons)].slice(0, 2)
}

/**
 * @param {import("./tacticalTradingZoneData.js").TradingStageHistoryEntry[]} history
 */
export function buildStagePathDisplay(history) {
  const log = formatStageHistoryLog(history ?? [])
  const segments = log.map((item) => ({
    dateLabel: item.dateLabel,
    stage: item.stage,
    label: TRADING_STAGE_META[item.stage]?.label ?? item.stage,
  }))
  const path = segments.map((s) => formatStageHistoryChipLabel(s)).join(" → ")
  return { path: path || "—", segments }
}

/**
 * @param {{
 *   marketPolicy?: { marketState?: MarketState; actionPolicy?: { lead?: string }; marketStateLabel?: string } | null
 *   synthesis?: { headline?: string } | null
 *   panicData?: object | null
 * }} input
 */
export function resolveMarketStockFocus(input = {}) {
  const { marketPolicy = null, synthesis = null, panicData = null } = input
  const state = marketPolicy?.marketState ?? "neutral"
  const regime = resolveHomeV5StrategyRegime(panicData)
  const regimeId = regime?.id ?? null

  let focusStage = MARKET_STATE_FOCUS[state] ?? "interest"
  let focusLabel = FOCUS_LABEL[focusStage] ?? "관심종목 우선"

  const headline = synthesis?.headline ?? marketPolicy?.marketStateLabel ?? "시장 상태 점검 중"

  if (regimeId === "dca" || regimeId === "panicBuy") {
    focusStage = "pullback"
    focusLabel = "분할매수 · 눌림종목 우선"
  } else if (regimeId === "interest") {
    focusStage = "interest"
    focusLabel = "관심종목 우선"
  } else if (regimeId === "overheated" || state === "overheat") {
    focusStage = "pullback"
    focusLabel = "눌림 대기 · 추격 금지"
  } else if (/추세/.test(headline) && state === "neutral") {
    focusStage = "trend"
    focusLabel = "추세종목 우선"
  } else if (/눌림/.test(headline) || state === "pullback" || state === "caution") {
    focusStage = "pullback"
    focusLabel = "눌림종목 우선"
  }

  return {
    marketHeadline: headline,
    actionLead: marketPolicy?.actionPolicy?.lead ?? "—",
    focusStage,
    focusLabel,
    regimeId,
    regimeLabel: regimeId ? (REGIME_LABEL[regimeId] ?? regime?.label ?? null) : null,
  }
}

/**
 * @param {TradingZonePosition} position
 * @param {Record<string, import("./tradingZoneStockEvaluation.js").TradingZoneStockEvaluation>} evalMap
 * @param {object | null} panicData
 */
function baseStockScore(position, evalMap, panicData) {
  const ev = evalMap[position.id]
  if (ev?.dataReady) return ev.tacticalScore
  const conf = buildTradingConfidenceBreakdown({
    position,
    panicData,
    activeAux: new Set(position.aux ?? []),
  })
  return conf.score
}

/**
 * @param {{
 *   positions: TradingZonePosition[]
 *   evalMap?: Record<string, import("./tradingZoneStockEvaluation.js").TradingZoneStockEvaluation>
 *   marketPolicy?: object | null
 *   panicData?: object | null
 *   market?: TradingMarketId
 *   limit?: number
 * }} input
 * @returns {MarketStockBridgeModel}
 */
export function buildMarketStockBridge(input = {}) {
  const {
    positions = [],
    evalMap = {},
    marketPolicy = null,
    panicData = null,
    market = "us",
    limit = 5,
  } = input

  const synthesis = buildHomeV5CoreSynthesis(panicData, marketPolicy)
  const focus = resolveMarketStockFocus({ marketPolicy, synthesis, panicData })
  const regimeId = focus.regimeId ?? "neutral"

  const boostKeys = new Set([
    ...(REGIME_SYMBOL_BOOST[focus.focusStage] ?? []),
    ...(REGIME_SYMBOL_BOOST[regimeId] ?? []),
    ...(REGIME_SYMBOL_BOOST.neutral ?? []),
  ])

  if (regimeId === "dca" || regimeId === "panicBuy") {
    REGIME_SYMBOL_BOOST.dca.forEach((s) => boostKeys.add(s))
  }

  /** @type {Record<TradingStageId, number>} */
  const stageRank = {
    interest: 0,
    pullback: 1,
    trend: 2,
    takeProfit: 3,
    risk: -1,
  }
  const focusRank = stageRank[focus.focusStage] ?? 0

  const filtered = positions.filter((p) => p.market === market)

  /** @type {MarketLinkedStockPriority[]} */
  const ranked = filtered.map((position) => {
    let score = baseStockScore(position, evalMap, panicData)
    const ev = evalMap[position.id]
    const pRank = stageRank[position.stage] ?? 0
    const regimeBoost = boostKeys.has(position.symbol)

    if (position.stage === focus.focusStage) score += 14
    else if (Math.abs(pRank - focusRank) === 1) score += 6
    else if (pRank > focusRank + 1) score -= 5

    if (regimeBoost) score += 9
    if (ev?.dataReady && ev.suggestedStage === focus.focusStage) score += 7

    if (focus.focusStage === "pullback" && position.stage === "trend") score -= 4
    if (focus.focusStage === "interest" && position.stage === "takeProfit") score -= 8

    score = Math.max(35, Math.min(99, Math.round(score)))
    const confidence = ev?.dataReady ? ev.confidence : Math.round(score * 0.92)
    const { path, segments } = buildStagePathDisplay(position.stageHistory)
    const stageLadder = buildCompactStageLadder(segments)
    const reasons = buildPriorityReasons(position, ev, {
      regimeBoost,
      focusStage: focus.focusStage,
    })

    return {
      id: position.id,
      symbol: position.symbol,
      stage: position.stage,
      stageLabel: TRADING_STAGE_META[position.stage]?.label ?? position.stage,
      score,
      confidence,
      confidenceLevel: resolveConfidenceLevel(confidence),
      stagePath: path,
      pathSegments: segments,
      stageLadder,
      reasons,
      confidenceBar: formatConfidenceBlockBar(confidence),
      regimeBoost,
    }
  })

  ranked.sort((a, b) => b.score - a.score)

  return {
    ready: filtered.length > 0,
    marketHeadline: focus.marketHeadline,
    actionLead: focus.actionLead,
    focusStage: focus.focusStage,
    focusLabel: focus.focusLabel,
    regimeId: focus.regimeId,
    regimeLabel: focus.regimeLabel,
    priorities: ranked.slice(0, limit),
  }
}
