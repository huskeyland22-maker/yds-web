import { buildAiReportMarketStatus } from "./buildAiReportMarketStatus.js"
import { buildResearchDeskBriefing } from "./researchDeskBriefing.js"
import { resolveMarketState } from "./marketStateEngine.js"

/**
 * 좌측 사이드바 시장 상태 (YDS 단계 · 행동 가이드 — VIX/F&G 수치 없음).
 * @param {object | null} panicData
 * @param {string} [_cycleStage] — 레거시 호환 (미사용)
 * @param {object[]} [historyRows]
 */
export function buildMarketSidebarPulse(panicData, _cycleStage, historyRows = []) {
  const status = buildAiReportMarketStatus(panicData, historyRows)
  const ms = resolveMarketState(panicData)

  return {
    aiReportStatus: status,
    marketLabel: status.stageLabel,
    updateTimestampLine: status.updateLine,
    basisLine: status.basisLine,
    /** @deprecated VIX/F&G는 핵심지수 카드에서만 표시 */
    vix: undefined,
    fearGreed: undefined,
    riskAppetite: ms.keySignalRisk,
    marketMood: ms.marketMood,
    marketStateKey: ms.stateKey,
    marketStateLabel: ms.label,
    leadingSector: "AI · 반도체",
    volatility: ms.volatility,
    cycleStage: status.stageLabel,
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
