import { buildResearchDeskBriefing } from "./researchDeskBriefing.js"
import { resolveMarketState } from "./marketStateEngine.js"

/**
 * 좌측 사이드바 MARKET STATUS (패닉지표 자동 계산).
 * @param {object | null} panicData
 * @param {string} [cycleStage] — 레거시 호환; 미전달 시 엔진 라벨 사용
 */
export function buildMarketSidebarPulse(panicData, cycleStage) {
  const ms = resolveMarketState(panicData)

  let riskAppetite = "—"
  if (ms.keySignalRisk === "ON") riskAppetite = "ON"
  else if (ms.keySignalRisk === "OFF") riskAppetite = "OFF"
  else if (ms.keySignalRisk === "혼합") riskAppetite = "혼합"

  return {
    riskAppetite,
    marketMood: ms.marketMood,
    leadingSector: "AI · 반도체",
    volatility: ms.volatility,
    marketStateLabel: ms.label,
    marketStateKey: ms.stateKey,
    marketStateColor: ms.color,
    basisLabelKst: ms.basisLabelKst,
    basisNote: ms.basisNote,
    cycleStage: typeof cycleStage === "string" && cycleStage !== "중립" ? cycleStage : ms.label,
  }
}

function inferForeignFlow(panicData, ms) {
  const pc = Number(panicData?.putCall)
  if (ms.stateKey === "fear_dominant" || ms.stateKey === "volatility_expansion" || ms.stateKey === "defensive") {
    return "방어·헤지 우위"
  }
  if (ms.stateKey === "risk_on") return "위험 선호 흐름"
  if (Number.isFinite(pc) && pc >= 1.02) return "옵션 방어 우위"
  return "중립 흐름"
}

/**
 * 밸류체인 히어로 우측 Today's Key Signal.
 */
export function buildTodaysKeySignal(sectors, panicData, cycleStage, options) {
  const desk = buildResearchDeskBriefing(sectors, panicData, options)
  const ms = desk.marketState
  const top = desk.hotSectors[0]
  const leading = top ? `${top.icon ? `${top.icon} ` : ""}${top.name}`.trim() : "—"

  return {
    riskOnOff: ms.label,
    riskDetail: `${ms.headline} · ${ms.basisNote}`,
    leadingSector: leading,
    foreignFlow: inferForeignFlow(panicData, ms),
    marketCycle: typeof cycleStage === "string" && cycleStage !== "중립" ? cycleStage : ms.label,
    theme: desk.todaysTheme,
    desk,
    marketState: ms,
    basisLabelKst: desk.basisLabelKst,
    basisNote: desk.basisNote,
    heatTimestampLine: desk.heatTimestampLine,
    heatBasisLine: desk.heatBasisLine,
  }
}
