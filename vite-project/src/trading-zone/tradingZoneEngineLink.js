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

/**
 * @typedef {{
 *   ready: boolean
 *   cards: EngineLinkCard[]
 *   guidance: string[]
 * }} TradingZoneEngineLink
 */

/**
 * @param {import("../utils/buildTodayActionPanel.js").TacticalCard[]} cards
 * @returns {string[]}
 */
function deriveGuidanceLines(cards) {
  const byId = Object.fromEntries(cards.map((c) => [c.id, c]))
  const short = byId.short
  const mid = byId.mid
  const long = byId.long
  const tactical = byId.tactical

  /** @type {string[]} */
  const lines = []

  const shortScore = short?.score ?? null
  const midScore = mid?.score ?? null
  const longScore = long?.score ?? null

  if (longScore != null && longScore < 35) {
    lines.push("거시 위험 · 신규 진입 축소")
  } else if (shortScore != null && shortScore >= 70 && midScore != null && midScore >= 55) {
    lines.push("관심 → 눌림 진입 허용 · 추세 추격 제한")
  } else if (shortScore != null && shortScore < 40) {
    lines.push("단기 경계 · 분할·확인 후 대응")
  } else if (midScore != null && midScore >= 60) {
    lines.push("중기 우호 · 선별적 비중 확대 검토")
  } else {
    lines.push("시장 혼조 · 관심유지·감시 위주")
  }

  if (tactical?.action) {
    const hint = tactical.scoreHint ? ` · ${tactical.scoreHint}` : ""
    lines.push(`실전 ${tactical.action}${hint}`)
  }

  return lines.slice(0, 2)
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
    return { ready: false, cards: [], guidance: [] }
  }

  const cards = panel.tacticalCards.map((c) => ({
    id: c.id,
    period: c.period,
    score: c.score,
    action: c.action,
    scoreLine: c.scoreLine,
    scoreHint: c.scoreHint,
  }))

  return {
    ready: true,
    cards,
    guidance: deriveGuidanceLines(cards),
  }
}
