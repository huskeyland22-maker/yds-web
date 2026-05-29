/**
 * 실전 매매 존 — 투자 전략 엔진(단·중·장·실전) 연계 (기존 HUD 값 재사용, 신규 점수 계산 없음)
 */
import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import { buildMarketPolicy } from "./marketPolicyEngine.js"
import { buildTradingZoneMarketStateBrief } from "./tradingZoneMarketStateBrief.js"
import { buildTodayActionPanel } from "../utils/buildTodayActionPanel.js"
import { getFinalScore } from "../utils/tradingScores.js"

/**
 * @typedef {{
 *   id: string
 *   period: string
 *   score: number | null
 *   action: string
 *   scoreLine: string | null
 *   scoreHint: string | null
 * }} EngineLinkCard
 */

/** @type {Record<string, string>} */
export const ENGINE_LINK_HORIZON_DOT = {
  short: "🟢",
  mid: "🟡",
  long: "⚪",
  tactical: "🔵",
}

/** @type {Record<string, string>} */
export const ENGINE_LINK_HORIZON_TOP_BAR = {
  short: "#22c55e",
  mid: "#facc15",
  long: "#94a3b8",
  tactical: "#3b82f6",
}

/** @type {string[]} */
export const ENGINE_LINK_CARD_ORDER = ["short", "mid", "long", "tactical"]

/**
 * @typedef {{
 *   emoji: string
 *   label: string
 * }} EngineLinkMacroStage
 */

/**
 * @typedef {{
 *   ready: boolean
 *   cards: EngineLinkCard[]
 *   actions: string[]
 *   actionLines?: { primary: string; caution: string; execution: string; summary: string }
 *   actionSummary?: string
 *   macroStage?: EngineLinkMacroStage | null
 *   marketBrief?: import("./tradingZoneMarketStateBrief.js").TradingZoneMarketStateBrief
 * }} TradingZoneEngineLink
 */

/**
 * 현재 행동 1줄 요약
 * @param {string[]} actions
 */
export function formatEngineActionSummary(actions) {
  if (!actions?.length) return ""

  const allow = actions.find((line) => !/제한|축소|경계/.test(line))
  const warn = actions.find((line) => /제한|축소|경계/.test(line))
  const parts = []

  if (allow) {
    const text = allow.replace(/\s*\/\s*/g, "·").replace(/\s+/g, " ").trim()
    parts.push(`🟢 ${text}`)
  }
  if (warn) {
    parts.push(`⚠ ${warn.trim()}`)
  }

  return parts.join(" | ")
}

/**
 * @param {{
 *   panicData?: object | null
 *   cycleScore?: number | null
 *   snapshot?: import("../macro-risk/engine.js").MacroRiskSnapshot | null
 *   historyRows?: object[]
 * }} input
 * @returns {TradingZoneEngineLink}
 */
export function buildTradingZoneEngineLink({
  panicData = null,
  cycleScore = null,
  snapshot = null,
  historyRows = [],
}) {
  const panel = buildTodayActionPanel({ panicData, cycleScore, snapshot, historyRows })

  if (!panel.ready || !panel.tacticalCards.length) {
    return { ready: false, cards: [], actions: [] }
  }

  const cards = panel.tacticalCards.map((c) => ({
    id: c.id,
    period: c.period,
    score: c.score,
    action: c.action,
    scoreLine: c.scoreLine,
    scoreHint: c.scoreHint,
  }))

  const marketPolicy = buildMarketPolicy({ panicData })
  const actionLines = marketPolicy.actionLines
  const actions = [actionLines.primary, actionLines.execution, actionLines.caution].filter(Boolean)

  const panicScore = panicData ? getFinalScore(panicData) : null
  const macro = resolveMacroV1Status(panicScore)
  const macroStage = macro
    ? { emoji: macro.emoji, label: macro.label }
    : null

  const marketBrief = buildTradingZoneMarketStateBrief({
    panicData,
    snapshot,
    historyRows,
    cycleScore,
    cards,
  })

  return {
    ready: true,
    cards,
    actions,
    actionLines,
    actionSummary: actionLines.summary || formatEngineActionSummary(actions),
    macroStage,
    marketBrief,
  }
}
