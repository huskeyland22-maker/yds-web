/**
 * 실전 매매 존 — 투자 전략 엔진(단·중·장·실전) 연계 (기존 HUD 값 재사용, 신규 점수 계산 없음)
 */
import { buildTodayActionPanel } from "../utils/buildTodayActionPanel.js"

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

/** @type {string[]} */
export const ENGINE_LINK_CARD_ORDER = ["short", "mid", "long", "tactical"]

/**
 * @typedef {{
 *   ready: boolean
 *   cards: EngineLinkCard[]
 *   actions: string[]
 *   actionSummary?: string
 * }} TradingZoneEngineLink
 */

/**
 * @param {EngineLinkCard[]} cards
 * @returns {string[]}
 */
function deriveActionLines(cards) {
  const byId = Object.fromEntries(cards.map((c) => [c.id, c]))
  const shortScore = byId.short?.score ?? null
  const midScore = byId.mid?.score ?? null
  const longScore = byId.long?.score ?? null

  if (longScore != null && longScore < 35) {
    return ["신규 진입 축소", "관심유지 · 감시 위주"]
  }
  if (shortScore != null && shortScore >= 70 && midScore != null && midScore >= 55) {
    return ["관심 / 눌림 진입 허용", "추세 추격 제한"]
  }
  if (shortScore != null && shortScore < 40) {
    return ["단기 경계 · 분할·확인 후 대응", "추세 추격 제한"]
  }
  if (midScore != null && midScore >= 60) {
    return ["선별적 비중 확대 검토", "추세 추격 제한"]
  }
  return ["관심유지 · 감시 위주", "추세 추격 제한"]
}

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

  const actions = deriveActionLines(cards)

  return {
    ready: true,
    cards,
    actions,
    actionSummary: formatEngineActionSummary(actions),
  }
}
