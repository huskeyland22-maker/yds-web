import { buildTradingConfidenceBreakdown } from "./tradingZoneConfidenceEngine.js"

/** @typedef {import("./tacticalTradingZoneData.js").TradingZonePosition} TradingZonePosition */

/** @param {unknown} v */
function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * @param {{
 *  positions: TradingZonePosition[]
 *  panicData?: object | null
 * }} input
 */
export function buildTradingPriorityRanking({ positions, panicData = null }) {
  const vix = toNum(panicData?.vix)
  const fg = toNum(panicData?.fearGreed)

  const ranked = positions.map((p) => {
    const confidence = buildTradingConfidenceBreakdown({
      position: p,
      panicData,
      activeAux: new Set(p.aux ?? []),
    })
    const stageBase =
      p.stage === "pullback" ? 18 : p.stage === "interest" ? 13 : p.stage === "trend" ? 11 : p.stage === "takeProfit" ? 5 : 2
    const volume = (p.stageHistory?.length ?? 0) >= 3 ? 8 : 2
    const rsi = (p.aux ?? []).includes("RSI") ? 7 : 0
    const maSupport = (p.aux ?? []).includes("20MA") ? 8 : 0
    const macroFit =
      (vix != null && vix < 25 ? 6 : 2) + (fg != null && fg >= 30 && fg <= 72 ? 5 : 1)
    const volatility = vix != null && vix <= 24 ? 6 : 2
    const trendKeep = p.stage === "trend" || p.stage === "pullback" ? 7 : 3
    const score = Math.max(
      40,
      Math.min(99, Math.round(confidence.score * 0.58 + stageBase + volume + rsi + maSupport + macroFit + volatility + trendKeep)),
    )

    const reasons = [
      volume >= 8 ? "거래량 증가" : "거래량 점검 필요",
      maSupport >= 8 ? "20MA 지지" : "이동평균 지지 약함",
      p.stage === "trend" || p.stage === "pullback" ? "추세 유지" : "추세 초기 단계",
      `신뢰도 ${confidence.score}`,
    ]
    const risks = []
    if (p.stage === "trend") risks.push("단기 과열 가능")
    if (p.stage === "takeProfit") risks.push("목표 근접")
    if ((p.stageHistory?.length ?? 0) <= 1) risks.push("거래량 둔화 시 약화")
    if (!risks.length) risks.push("변동성 확대 가능성")
    const action = p.stage === "pullback" ? "눌림 대기 후 분할 진입" : p.stage === "interest" ? "관심 유지 · 눌림 대기" : "추격 금지 · 분할 대응"

    return { symbol: p.symbol, score, reasons, risks, action, stage: p.stage }
  })

  ranked.sort((a, b) => b.score - a.score)
  return ranked
}

