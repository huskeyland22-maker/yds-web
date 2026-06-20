import { selectActiveTriggerCards } from "../macro-risk/macroRiskDisplayTriggers.js"
import { deriveBondLiquidityStatuses, isBondLiquidityConfirming } from "./bondLiquidityStatus.js"
import { buildMarketOsIntegrated } from "./buildMarketOsIntegrated.js"
import { panicNineStressScore } from "./panicNine.js"
import { fearProgressPct, resolveCyclePosition } from "./positionLabels.js"

/**
 * @typedef {Object} MarketOsPhase2
 * @property {number|null} cycleScore
 * @property {string[]} bondStatuses
 * @property {boolean} bondConfirming
 * @property {string[]} currentPosition
 * @property {{ cash: string; strategy: string; chase: string; ai: string }} practicalActions
 * @property {{ favor: string[]; hostile: string[] }} sectors
 * @property {string[]} forbiddenActions
 * @property {{ cycle: { score: number|null; pct: number|null; variant: string }; cycleLabel: string; bondStatuses: string[] }} positionMap
 * @property {{ long: string; mid: string; short: string; cash: string }} playbook
 * @property {number|null} panicStressScore
 */

/**
 * Cycle + Bond 보조 + 8대 패닉 + 트리거 → 행동 변환 (Cycle 최종)
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
  const cycle = resolveCyclePosition(c)
  const bondConfirming = base.bondConfirming
  const bondStatuses = base.bondStatuses

  const triggers = snapshot?.triggers ?? []
  const activeCards = selectActiveTriggerCards(triggers)
  const rateTrig = activeCards.some((t) => t.id === "rate_repricing_event" || t.id === "rate_shock")
  const dollarTrig = activeCards.some((t) => t.id === "dollar_pressure")

  /** @type {string[]} */
  const currentPosition = []
  if (cycle.position && cycle.position !== "데이터 대기") currentPosition.push(cycle.position)
  for (const s of bondStatuses) {
    if (!currentPosition.includes(s)) currentPosition.push(s)
  }
  if (!currentPosition.length) currentPosition.push("데이터 수집 중")

  const strategy =
    Number.isFinite(c) && c <= 30
      ? "분할·인내"
      : bondConfirming && rateTrig
        ? "보수"
        : Number.isFinite(c) && c >= 55 && !bondConfirming
          ? "균형·추세"
          : bondConfirming
            ? "방어"
            : "균형"

  const practicalActions = {
    cash: base.actionNow.cash,
    strategy,
    chase:
      (Number.isFinite(c) && c < 30) || (bondConfirming && rateTrig) ? "금지" : bondConfirming ? "선별" : "추세 확인",
    ai: base.actionNow.ai,
  }

  const favor = []
  const hostile = []
  if (Number.isFinite(c) && c <= 32) {
    favor.push("가치", "배당", "현금")
    hostile.push("추격 매수", "레버리지")
  } else if (bondConfirming && rateTrig) {
    favor.push("방어", "배당", "가치", "현금")
    hostile.push("성장", "AI", "반도체")
  } else if (Number.isFinite(c) && c >= 52 && !bondConfirming) {
    favor.push("반도체", "AI", "성장")
    hostile.push("무리한 집중")
  } else {
    favor.push("혼합", "대형주")
    hostile.push("풀비중")
  }

  /** @type {string[]} */
  const forbiddenActions = [...base.forbiddenActions]
  if (bondConfirming && rateTrig && !forbiddenActions.includes("성장주 추격 금지")) {
    forbiddenActions.unshift("성장주 추격 금지")
  }
  if (bondConfirming && dollarTrig && !forbiddenActions.some((x) => x.includes("리스크"))) {
    forbiddenActions.push("리스크 자산 확대")
  }

  const playbook = {
    long:
      Number.isFinite(c) && c <= 32
        ? "기회 탐색"
        : bondConfirming && rateTrig
          ? "방어"
          : Number.isFinite(c) && c >= 55
            ? "추세"
            : "균형",
    mid: rateTrig ? "눌림 대기" : dollarTrig ? "유동성 관망" : Number.isFinite(c) && c <= 35 ? "분할" : "비중 점검",
    short: practicalActions.chase === "금지" ? "추격 금지" : "추세 확인",
    cash: practicalActions.cash,
  }

  return {
    cycleScore: c,
    bondStatuses,
    bondConfirming,
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
      cycleLabel: cycle.position,
      bondStatuses,
    },
    playbook,
    panicStressScore: panicNineStressScore(panicData),
  }
}
