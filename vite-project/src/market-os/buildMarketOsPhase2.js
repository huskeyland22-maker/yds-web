import { selectActiveTriggerCards } from "../macro-risk/macroRiskDisplayTriggers.js"
import { buildMarketOsIntegrated } from "./buildMarketOsIntegrated.js"
import { panicNineStressScore } from "./panicNine.js"
import {
  dangerProgressPct,
  fearProgressPct,
  resolveCyclePosition,
  resolveMacroPosition,
} from "./positionLabels.js"

/**
 * @typedef {Object} MarketOsPhase2
 * @property {number|null} cycleScore
 * @property {number|null} macroScore
 * @property {string[]} currentPosition
 * @property {{ cash: string; strategy: string; chase: string; ai: string }} practicalActions
 * @property {{ favor: string[]; hostile: string[] }} sectors
 * @property {string[]} forbiddenActions
 * @property {{ cycle: { score: number|null; pct: number|null; variant: string }; macro: { score: number|null; pct: number|null; variant: string }; cycleLabel: string; macroLabel: string }} positionMap
 * @property {{ long: string; mid: string; short: string; cash: string }} playbook
 * @property {number|null} panicStressScore
 */

/**
 * Cycle + Macro + 9대 패닉 + 트리거 → 행동 변환
 * @param {{
 *   cycleScore: number|null|undefined;
 *   snapshot: import("../macro-risk/engine.js").MacroRiskSnapshot | null;
 *   panicData?: object | null;
 * }} input
 * @returns {MarketOsPhase2}
 */
export function buildMarketOsPhase2({ cycleScore, snapshot, panicData = null }) {
  const base = buildMarketOsIntegrated({ cycleScore, snapshot })
  const c = base.cycleScore
  const m = base.macroScore
  const cycle = resolveCyclePosition(c)
  const macro = resolveMacroPosition(m)

  const triggers = snapshot?.triggers ?? []
  const activeCards = selectActiveTriggerCards(triggers)
  const rateTrig = activeCards.some((t) => t.id === "rate_repricing_event" || t.id === "rate_shock")
  const dollarTrig = activeCards.some((t) => t.id === "dollar_pressure")
  const easingTrig = triggers.some((t) => t.active && t.id === "liquidity_easing")

  const ratePillar = snapshot?.pillars?.find((p) => p.id === "rate")
  const marketImpact = ratePillar?.status ?? "매크로 혼합"

  /** @type {string[]} */
  const currentPosition = []
  if (cycle.position && cycle.position !== "데이터 대기") currentPosition.push(cycle.position)
  if (base.macroPhase) currentPosition.push(base.macroPhase)
  if (marketImpact && !currentPosition.includes(marketImpact)) currentPosition.push(marketImpact)
  for (const t of activeCards) {
    const label = t._cardLabel ?? t.label
    if (label && !currentPosition.includes(label)) currentPosition.push(label)
  }
  if (!currentPosition.length) currentPosition.push("데이터 수집 중")

  const strategy =
    Number.isFinite(m) && m >= 75
      ? "방어"
      : rateTrig
        ? "보수"
        : Number.isFinite(c) && c <= 30 && Number.isFinite(m) && m < 55
          ? "분할·인내"
          : "균형"

  const practicalActions = {
    cash: base.actionNow.cash,
    strategy,
    chase: rateTrig || (Number.isFinite(m) && m >= 60) ? "금지" : "선별",
    ai: base.actionNow.ai,
  }

  const favor = []
  const hostile = []
  if (Number.isFinite(m) && m >= 58) {
    favor.push("방어", "배당", "가치", "현금")
    hostile.push("성장", "AI", "반도체")
  } else if (Number.isFinite(m) && m <= 45 && easingTrig) {
    favor.push("반도체", "AI", "성장")
    hostile.push("레버리지 확대")
  } else if (Number.isFinite(c) && c <= 35) {
    favor.push("가치", "배당")
    hostile.push("추격 매수")
  } else {
    favor.push("혼합", "대형주")
    hostile.push("무리한 집중")
  }

  /** @type {string[]} */
  const forbiddenActions = []
  if (Number.isFinite(m) && m > 80) forbiddenActions.push("성장주 추격 금지")
  if (Number.isFinite(c) && c < 30) forbiddenActions.push("풀비중 금지")
  if (Number.isFinite(m) && m > 90) forbiddenActions.push("현금 확대")
  if (rateTrig) forbiddenActions.push("성장주 추격")
  if (dollarTrig) forbiddenActions.push("리스크 자산 확대")
  if (!forbiddenActions.length) forbiddenActions.push("무리한 비중 확대")

  const playbook = {
    long: Number.isFinite(m) && m >= 70 ? "방어" : Number.isFinite(c) && c <= 35 ? "기회 탐색" : "균형",
    mid: rateTrig ? "눌림 대기" : dollarTrig ? "유동성 관망" : "비중 점검",
    short: rateTrig || (Number.isFinite(m) && m >= 60) ? "추격 금지" : "추세 확인",
    cash: practicalActions.cash,
  }

  return {
    cycleScore: c,
    macroScore: m,
    currentPosition,
    practicalActions,
    sectors: { favor, hostile },
    forbiddenActions,
    positionMap: {
      cycle: {
        score: c,
        pct: fearProgressPct(c),
        variant: "cycle",
      },
      macro: {
        score: m,
        pct: dangerProgressPct(m),
        variant: "macro",
      },
      cycleLabel: cycle.position,
      macroLabel: macro.position,
    },
    playbook,
    panicStressScore: panicNineStressScore(panicData),
  }
}
