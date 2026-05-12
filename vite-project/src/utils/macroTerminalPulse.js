import { buildValueChainHeaderBundle } from "./valueChainHero.js"

/**
 * 좌측 사이드바 MARKET STATUS (터미널 스타일 요약).
 * @param {object | null} panicData
 * @param {string} cycleStage — getMarketCycleStage 결과
 */
export function buildMarketSidebarPulse(panicData, cycleStage) {
  const fg = Number(panicData?.fearGreed)
  const vix = Number(panicData?.vix)

  let riskAppetite = "—"
  if (Number.isFinite(fg) && Number.isFinite(vix)) {
    if (vix < 18 && fg >= 56) riskAppetite = "ON"
    else if (vix > 23 || fg <= 38) riskAppetite = "OFF"
    else riskAppetite = "혼합"
  } else if (Number.isFinite(fg)) {
    riskAppetite = fg >= 58 ? "ON" : fg <= 40 ? "OFF" : "혼합"
  }

  let marketMood = "—"
  if (Number.isFinite(fg)) {
    marketMood = fg >= 62 ? "Positive" : fg <= 38 ? "Defensive" : "Neutral"
  }

  let volatility = "—"
  if (Number.isFinite(vix)) {
    volatility = vix < 16 ? "Muted" : vix > 22 ? "Elevated" : "Stable"
  }

  return {
    riskAppetite,
    marketMood,
    leadingSector: "AI · 반도체",
    volatility,
    cycleStage: typeof cycleStage === "string" ? cycleStage : "—",
  }
}

function inferForeignFlow(panicData) {
  const fg = Number(panicData?.fearGreed)
  const pc = Number(panicData?.putCall)
  if (!Number.isFinite(fg) && !Number.isFinite(pc)) return "확인 필요"
  if (Number.isFinite(pc) && pc >= 1.02) return "옵션 방어 우위"
  if (Number.isFinite(fg) && fg >= 58) return "추격 심리 가능"
  if (Number.isFinite(fg) && fg <= 40) return "관망·유출 경계"
  return "혼재"
}

/**
 * 밸류체인 히어로 우측 Today's Key Signal.
 */
export function buildTodaysKeySignal(sectors, panicData, cycleStage) {
  const bundle = buildValueChainHeaderBundle(sectors, panicData)
  const top = bundle.hotSectors[0]
  const leading = top
    ? `${top.icon ? `${top.icon} ` : ""}${top.name}`.trim()
    : "—"

  return {
    riskOnOff: bundle.riskRegimeLabel,
    riskDetail: bundle.riskRegimeDetail,
    leadingSector: leading,
    foreignFlow: inferForeignFlow(panicData),
    marketCycle: typeof cycleStage === "string" ? cycleStage : "—",
    theme: bundle.marketEnergy,
  }
}
