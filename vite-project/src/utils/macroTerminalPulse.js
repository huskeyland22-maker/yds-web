import { buildResearchDeskBriefing } from "./researchDeskBriefing.js"
import { resolveCycleZone } from "./cycleZoneLabels.js"
import { resolveMarketState } from "./marketStateEngine.js"
import { getFinalScore } from "./tradingScores.js"

/**
 * 좌측 사이드바 시장 상태 (축약).
 * @param {object | null} panicData
 * @param {string} [cycleStage] — 레거시 호환
 */
export function buildMarketSidebarPulse(panicData, cycleStage) {
  const ms = resolveMarketState(panicData)
  const cycleScore = panicData ? getFinalScore(panicData) : null
  const zone = resolveCycleZone(cycleScore)

  const marketLabel =
    zone.zone != null ? zone.zoneLabel : typeof cycleStage === "string" && cycleStage !== "중립" ? cycleStage : ms.label

  const vix = Number.isFinite(Number(panicData?.vix)) ? Number(panicData.vix).toFixed(1) : "—"
  const fg = Number.isFinite(Number(panicData?.fearGreed)) ? String(Math.round(Number(panicData.fearGreed))) : "—"

  return {
    marketLabel,
    vix,
    fearGreed: fg,
    updateTimestampLine: ms.updateTimestampLine,
    basisLine: ms.basisLine,
    /** @deprecated 레거시 필드 — 신규 UI는 marketLabel·vix·fearGreed 사용 */
    riskAppetite: ms.keySignalRisk,
    marketMood: ms.marketMood,
    leadingSector: "AI · 반도체",
    volatility: ms.volatility,
    cycleStage: marketLabel,
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
export function buildTodaysKeySignal(sectors, panicData, cycleStage) {
  const desk = buildResearchDeskBriefing(sectors, panicData)
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
    updateTimestampLine: desk.updateTimestampLine,
    basisLine: desk.basisLine,
  }
}
