import { buildMarketSidebarPulse } from "./macroTerminalPulse.js"

function foreignFlowEnglish(panicData) {
  const fg = Number(panicData?.fearGreed)
  const pc = Number(panicData?.putCall)
  if (!Number.isFinite(fg) && !Number.isFinite(pc)) return "—"
  if (Number.isFinite(pc) && pc >= 1.02) return "Defensive"
  if (Number.isFinite(fg) && fg >= 58) return "Positive"
  if (Number.isFinite(fg) && fg <= 40) return "Cautious"
  return "Mixed"
}

/**
 * /cycle 상단 기관형 히어로 — 좌·중·우 컨텍스트.
 * @param {object | null} panicData
 * @param {string} cycleStage
 * @param {{ short: string; mid: string; long: string }} heroSummary
 */
export function buildCycleDeskHeroContext(panicData, cycleStage, heroSummary) {
  const hs =
    heroSummary && typeof heroSummary === "object"
      ? heroSummary
      : { short: "—", mid: "—", long: "—", stage: cycleStage ?? "—" }
  const fg = Number(panicData?.fearGreed)
  const vix = Number(panicData?.vix)
  const pc = Number(panicData?.putCall)
  const move = Number(panicData?.move)

  /** @type {string[]} */
  const flowBullets = []

  flowBullets.push("AI·데이터 인프라 축을 중심으로 밸류체인 온도가 유지되는 국면으로 읽는다.")

  if (Number.isFinite(fg)) {
    if (fg >= 62) flowBullets.push("중기 심리는 위험선호가 우세해 선별적 risk-on·비중 관리가 병행된다.")
    else if (fg <= 38) flowBullets.push("심리는 방어 쪽으로 기울어 분할·현금 탄력을 우선하는 편이 안전하다.")
    else flowBullets.push("심리는 중립대에서 방향 확인이 필요하고, 지수 대비 섹터 온도 차를 본다.")
  } else {
    flowBullets.push("중기 심리 지표 동기화 후 흐름을 보완한다.")
  }

  if (Number.isFinite(vix)) {
    if (vix < 17) flowBullets.push("단기 변동성은 낮아 추격보다 눌림·지지 확인이 유효한 구간이다.")
    else if (vix >= 24) flowBullets.push("단기 변동성은 확대돼 포지션 크기·옵션 헤지를 염두에 둔다.")
    else flowBullets.push("변동성은 중립에서 벗어나지 않아 과도한 방어는 선택적으로만 취한다.")
  }

  if (Number.isFinite(pc) && pc >= 1.02) {
    flowBullets.push("옵션 풋비중이 높아 단기 조정 시 수급 민감도가 커질 수 있다.")
  } else if (Number.isFinite(move) && move >= 100) {
    flowBullets.push("채권 변동성(MOVE)이 붙어 금리 민감 자산은 변동에 더 민감하다.")
  }

  const pulse = buildMarketSidebarPulse(panicData, cycleStage)
  const stageStyle =
    cycleStage === "과열" || cycleStage === "탐욕"
      ? "greed"
      : cycleStage === "공포" || cycleStage === "패닉"
        ? "fear"
        : "neutral"

  return {
    stageLabel: cycleStage,
    stageStyle,
    tierHints: {
      tactical: hs.short ?? "—",
      strategic: hs.mid ?? "—",
      macro: hs.long ?? "—",
    },
    flowBullets: flowBullets.slice(0, 4),
    keySignal: {
      riskAppetite: pulse.riskAppetite === "ON" ? "ON" : pulse.riskAppetite === "OFF" ? "OFF" : "Mix",
      leadingSector: "AI",
      volatility: pulse.volatility,
      foreignFlow: foreignFlowEnglish(panicData),
    },
  }
}
