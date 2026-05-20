import {
  dangerProgressPct,
  fearProgressPct,
  resolveCyclePosition,
  resolveMacroPosition,
} from "./positionLabels.js"

/**
 * @typedef {Object} MarketOsIntegrated
 * @property {number|null} cycleScore
 * @property {number|null} macroScore
 * @property {string} positionSummary
 * @property {string} cyclePhase
 * @property {string} macroPhase
 * @property {string} marketImpact
 * @property {number|null} fearProgressPct
 * @property {number|null} dangerProgressPct
 * @property {string} recommendedAction
 * @property {string} recommendedSector
 * @property {string[]} forbiddenActions
 * @property {string} briefing
 * @property {{ today: string; ai: string; cash: string; risk: string }} actionNow
 */

/**
 * Cycle + Macro → 실전 행동·섹터·금지 (순수 함수).
 * @param {{ cycleScore: number|null|undefined; snapshot: import("../macro-risk/engine.js").MacroRiskSnapshot | null }} input
 * @returns {MarketOsIntegrated}
 */
export function buildMarketOsIntegrated({ cycleScore, snapshot }) {
  const macroScore = snapshot?.score ?? null
  const cycle = resolveCyclePosition(cycleScore)
  const macro = resolveMacroPosition(macroScore)

  const ratePillar = snapshot?.pillars?.find((p) => p.id === "rate")
  const inflPillar = snapshot?.pillars?.find((p) => p.id === "inflation")
  const rateN = ratePillar?.score ?? 50
  const inflN = inflPillar?.score ?? 50

  const macroHeadline = String(snapshot?.headline ?? "")
    .replace(/\s*이벤트\s*$/u, "")
    .trim()

  const marketImpact = ratePillar?.status ?? "매크로 혼합"
  const rateTrig = Boolean(
    snapshot?.triggers?.some(
      (t) => t.active && (t.id === "rate_repricing_event" || t.id === "rate_shock"),
    ),
  )
  const dollarTrig = Boolean(snapshot?.triggers?.some((t) => t.active && t.id === "dollar_pressure"))

  const fearPct = fearProgressPct(cycleScore)
  const dangerPct = dangerProgressPct(macroScore)

  const macroPhase = macroHeadline || macro.phaseLine
  const positionSummary = [cycle.position, macroPhase].filter((x) => x && x !== "—").join(" · ")

  const briefingParts = [cycle.phaseLine, macroPhase, marketImpact].filter(Boolean)
  const briefing = briefingParts.join(" · ")

  const m = Number(macroScore)
  const c = Number(cycleScore)

  let recommendedAction = "관망"
  if (Number.isFinite(m) && m >= 75) recommendedAction = "방어"
  else if (rateTrig) recommendedAction = "방어"
  else if (Number.isFinite(c) && c <= 30 && Number.isFinite(m) && m < 55) recommendedAction = "분할 매수 검토"
  else if (Number.isFinite(m) && m >= 55) recommendedAction = "보수·선별"
  else if (Number.isFinite(c) && c <= 45) recommendedAction = "기회 탐색"

  let recommendedSector = "혼합·대형"
  if (rateN >= 58 && inflN < 68) recommendedSector = "방어·현금흐름"
  else if (rateN >= 62 || rateTrig) recommendedSector = "방어·배당"
  else if (Number.isFinite(m) && m <= 40) recommendedSector = "성장·AI 선별"

  /** @type {string[]} */
  const forbiddenActions = []
  if (rateTrig || (Number.isFinite(m) && m >= 60)) forbiddenActions.push("추격 금지")
  if (rateTrig || dollarTrig) forbiddenActions.push("성장 추격")
  if (Number.isFinite(m) && m >= 70) forbiddenActions.push("레버리지 확대")
  if (!forbiddenActions.length) forbiddenActions.push("무리한 비중 확대")

  const cash = !Number.isFinite(m)
    ? "—"
    : m >= 80
      ? "20~30"
      : m >= 60
        ? "18~28"
        : m >= 40
          ? "12~22"
          : "8~15"

  const actionNow = {
    today: rateTrig || (Number.isFinite(m) && m >= 60) ? "추격 금지" : "추세 확인",
    ai: rateTrig ? "눌림 대기" : Number.isFinite(c) && c <= 35 ? "분할 관심" : "선별 관망",
    cash,
    risk: rateTrig ? "금리 우선" : dollarTrig ? "유동성·달러" : "금리 추세",
  }

  return {
    cycleScore: Number.isFinite(c) ? Math.round(c) : null,
    macroScore: Number.isFinite(m) ? Math.round(m) : null,
    positionSummary: positionSummary || "—",
    cyclePhase: cycle.position,
    macroPhase,
    marketImpact,
    fearProgressPct: fearPct,
    dangerProgressPct: dangerPct,
    recommendedAction,
    recommendedSector,
    forbiddenActions,
    briefing,
    actionNow,
  }
}
