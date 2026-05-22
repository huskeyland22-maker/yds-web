/**
 * 패닉·시장상태·산업강도 → 일별 AI 리포트 (createDailyReport)
 */
import { generatePanicMarketReport } from "./panicMarketReportEngine.js"
import { sectorFlowFromPanic } from "./sectorFlowLite.js"
import { computeMarketState } from "./marketCycleCompute.js"
import { getFinalScore } from "./panicScores.js"

/** @type {Record<string, string>} */
export const SECTOR_KO_LABELS = {
  "ai-semiconductor": "AI·반도체",
  "power-infra": "전력·원전",
  "robot-automation": "로봇",
  "defense-space": "방산",
  shipbuilding: "조선",
  "bio-healthcare": "바이오",
  "battery-materials": "2차전지",
}

const MARKET_STATE_KO = {
  risk_on: "Risk-on",
  neutral: "중립",
  fear_dominant: "공포 우세",
  volatility_expansion: "변동성 확대",
  defensive: "방어",
  insufficient: "지표 부족",
}

function formatMarketView(cycleRow, panicScore) {
  if (!cycleRow) {
    return panicScore != null ? `패닉지수 ${Math.round(panicScore)}` : ""
  }
  const parts = []
  if (cycleRow.panic_score != null) parts.push(`패닉 ${Math.round(Number(cycleRow.panic_score))}`)
  if (cycleRow.market_state) {
    parts.push(MARKET_STATE_KO[cycleRow.market_state] ?? cycleRow.market_state)
  }
  if (cycleRow.risk_signal) parts.push(`리스크 ${cycleRow.risk_signal}`)
  if (cycleRow.short_score != null && cycleRow.mid_score != null) {
    parts.push(`단기 ${Math.round(cycleRow.short_score)} / 중기 ${Math.round(cycleRow.mid_score)}`)
  }
  return parts.join(" · ")
}

function buildLongStrategy(baseLong, leaderSectors) {
  const names = leaderSectors
    .map((s) => SECTOR_KO_LABELS[s.id] ?? s.shortLabel ?? s.label)
    .filter(Boolean)
  if (!names.length) return baseLong
  return `${baseLong}\n\n우선 산업:\n${names.map((n) => `· ${n}`).join("\n")}`
}

function enrichShortStrategy(shortTerm, cycleRow) {
  if (!cycleRow) return shortTerm
  const ps = Number(cycleRow.panic_score)
  if (Number.isFinite(ps) && ps >= 65) {
    return `${shortTerm}\n\n과열 일부 존재 — 눌림·분할 매수 검토`
  }
  if (cycleRow.market_state === "risk_on") {
    return `${shortTerm}\n\n단기 모멘텀 양호 — 추격보다 눌림 매수`
  }
  return shortTerm
}

function buildRiskNote(risks, cycleRow) {
  const lines = [...(risks || [])]
  if (cycleRow?.volatility === "확대") {
    lines.unshift("변동성 확대 구간 — 헤지·비중 관리")
  }
  if (cycleRow?.risk_signal === "OFF") {
    lines.push("리스크 신호 OFF — 방어 우선")
  } else if (cycleRow?.risk_signal === "ON") {
    lines.push("리스크 신호 ON — 선별적 Risk-on")
  }
  const uniq = [...new Set(lines.filter(Boolean))]
  return uniq.length ? uniq.join("\n") : "특이 리스크 제한적"
}

/**
 * @param {object} panicData
 * @param {object | null} cycleRow — market_cycle_history row
 * @param {string} [tradeDate]
 */
export function createDailyReport(panicData, cycleRow = null, tradeDate) {
  const base = generatePanicMarketReport(panicData)
  if (!base) return null

  const date =
    tradeDate ||
    base.tradeDate ||
    (cycleRow?.date ? String(cycleRow.date).slice(0, 10) : null) ||
    new Date().toISOString().slice(0, 10)

  const stateKey = cycleRow?.market_state ?? null
  const marketState = stateKey
    ? { stateKey, label: MARKET_STATE_KO[stateKey] ?? stateKey }
    : computeMarketState(
        {
          vix: panicData?.vix,
          fearGreed: panicData?.fearGreed,
          bofa: panicData?.bofa,
          putCall: panicData?.putCall,
          highYield: panicData?.highYield,
        },
        null,
      )

  const flow = sectorFlowFromPanic(panicData, marketState)
  const panicScore =
    cycleRow?.panic_score != null
      ? Number(cycleRow.panic_score)
      : getFinalScore({
          vix: panicData?.vix,
          fearGreed: panicData?.fearGreed,
          putCall: panicData?.putCall,
          bofa: panicData?.bofa,
          highYield: panicData?.highYield,
        })

  const priorityNames = flow.leaderSector
    .map((s) => SECTOR_KO_LABELS[s.id] ?? s.shortLabel)
    .join(" · ")

  const short_strategy = enrichShortStrategy(
    cycleRow?.recommendation || base.shortTerm,
    cycleRow,
  )
  const mid_strategy =
    cycleRow?.mid_score != null && Number(cycleRow.mid_score) >= 60
      ? "비중 확대"
      : base.midTerm
  const long_strategy = buildLongStrategy(base.longTerm, flow.leaderSector)

  return {
    date,
    summary: base.summary,
    market_view: formatMarketView(cycleRow, panicScore),
    short_strategy,
    mid_strategy,
    long_strategy,
    risk_note: buildRiskNote(base.risks, cycleRow),
    priority_sector: priorityNames || base.sector,
    panic_score: panicScore,
    market_state: stateKey,
    sectorScores: flow.scores,
    sectorFlow: flow,
    // PanicMarketReportPanel 호환
    shortTerm: short_strategy,
    midTerm: mid_strategy,
    longTerm: long_strategy,
    risk: buildRiskNote(base.risks, cycleRow).replace(/\n/g, " · "),
    sector: priorityNames || base.sector,
    risks: base.risks,
    actionMode: base.actionMode,
    regimeLabel: base.regimeLabel,
    tradeDate: date,
  }
}
