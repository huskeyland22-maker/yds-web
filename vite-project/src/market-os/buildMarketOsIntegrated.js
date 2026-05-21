import {
  deriveBondLiquidityStatuses,
  isBondLiquidityConfirming,
} from "./bondLiquidityStatus.js"
import {
  fearProgressPct,
  resolveCyclePosition,
} from "./positionLabels.js"

/**
 * @typedef {Object} MarketOsIntegrated
 * @property {number|null} cycleScore
 * @property {number|null} macroScore
 * @property {string[]} bondStatuses
 * @property {boolean} bondConfirming
 * @property {string} positionSummary
 * @property {string} cyclePhase
 * @property {string} macroPhase
 * @property {string} marketImpact
 * @property {number|null} fearProgressPct
 * @property {string} recommendedAction
 * @property {string} recommendedSector
 * @property {string[]} forbiddenActions
 * @property {string} briefing
 * @property {{ today: string; ai: string; cash: string; risk: string }} actionNow
 */

/**
 * Cycle 우선 + Bond 보조 확인 (순수 함수).
 * @param {{ cycleScore: number|null|undefined; snapshot: import("../macro-risk/engine.js").MacroRiskSnapshot | null }} input
 * @returns {MarketOsIntegrated}
 */
export function buildMarketOsIntegrated({ cycleScore, snapshot }) {
  const macroScore = snapshot?.score ?? null
  const cycle = resolveCyclePosition(cycleScore)
  const bondStatuses = deriveBondLiquidityStatuses(snapshot)
  const bondConfirming = isBondLiquidityConfirming(snapshot)

  const ratePillar = snapshot?.pillars?.find((p) => p.id === "rate")
  const rateN = ratePillar?.score ?? 50

  const rateTrig = Boolean(
    snapshot?.triggers?.some(
      (t) => t.active && (t.id === "rate_repricing_event" || t.id === "rate_shock"),
    ),
  )
  const dollarTrig = Boolean(snapshot?.triggers?.some((t) => t.active && t.id === "dollar_pressure"))

  const fearPct = fearProgressPct(cycleScore)
  const macroPhase = bondStatuses.slice(0, 2).join(" · ") || "채권·유동성 확인"
  const marketImpact = ratePillar?.status ?? "—"
  const positionSummary = [cycle.position, macroPhase].filter((x) => x && x !== "—").join(" · ")

  const briefingParts = [cycle.phaseLine, macroPhase, marketImpact].filter(Boolean)
  const briefing = briefingParts.join(" · ")

  const c = Number(cycleScore)

  let recommendedAction = "관망"
  if (Number.isFinite(c) && c <= 28) recommendedAction = "분할·인내"
  else if (Number.isFinite(c) && c <= 38) recommendedAction = "기회 탐색"
  else if (bondConfirming && rateTrig) recommendedAction = "방어"
  else if (bondConfirming) recommendedAction = "보수·선별"
  else if (Number.isFinite(c) && c >= 55) recommendedAction = "추세 추종"

  let recommendedSector = "혼합·대형"
  if (Number.isFinite(c) && c <= 32) recommendedSector = "가치·배당"
  else if (bondConfirming && rateN >= 55) recommendedSector = "방어·배당·현금"
  else if (Number.isFinite(c) && c >= 52 && !bondConfirming) recommendedSector = "성장·AI 선별"

  /** @type {string[]} */
  const forbiddenActions = []
  if (Number.isFinite(c) && c < 30) forbiddenActions.push("풀비중 금지")
  if (bondConfirming && rateTrig) forbiddenActions.push("추격 금지")
  if (bondConfirming && (rateTrig || dollarTrig)) forbiddenActions.push("성장 추격")
  if (Number.isFinite(c) && c <= 35 && bondConfirming) forbiddenActions.push("레버리지 확대")
  if (!forbiddenActions.length) forbiddenActions.push("무리한 비중 확대")

  const cash = resolveCashFromCycle(c, bondConfirming)

  const actionNow = {
    today:
      Number.isFinite(c) && c < 30
        ? "분할 대기"
        : bondConfirming && rateTrig
          ? "추격 금지"
          : "추세 확인",
    ai:
      Number.isFinite(c) && c <= 35
        ? "분할 관심"
        : bondConfirming && rateTrig
          ? "눌림 대기"
          : "선별 관망",
    cash,
    risk: bondConfirming ? (rateTrig ? "금리 우선" : "유동성·달러") : "Cycle·패닉",
  }

  return {
    cycleScore: Number.isFinite(c) ? Math.round(c) : null,
    macroScore: Number.isFinite(Number(macroScore)) ? Math.round(Number(macroScore)) : null,
    bondStatuses,
    bondConfirming,
    positionSummary: positionSummary || "—",
    cyclePhase: cycle.position,
    macroPhase,
    marketImpact,
    fearProgressPct: fearPct,
    recommendedAction,
    recommendedSector,
    forbiddenActions,
    briefing,
    actionNow,
  }
}

/**
 * @param {number} c
 * @param {boolean} bondConfirming
 */
function resolveCashFromCycle(c, bondConfirming) {
  if (!Number.isFinite(c)) return "—"
  if (c <= 28) return "25~35"
  if (c <= 38) return "18~28"
  if (c <= 48) return bondConfirming ? "20~30" : "12~22"
  if (c <= 58) return bondConfirming ? "15~25" : "10~18"
  return bondConfirming ? "12~20" : "8~15"
}
