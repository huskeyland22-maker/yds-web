/**
 * 신뢰도 분해 엔진
 * - 점수 구성요소를 분해해 UI에 설명 가능하도록 반환
 * - 향후 백테스트/승률/AI 추천 확장용 가중치 테이블 포함
 */

/** @typedef {import("./tacticalTradingZoneData.js").TradingZonePosition} TradingZonePosition */

/** @type {Record<string, number>} */
export const CONFIDENCE_WEIGHT_TABLE = {
  volumeUp: 22,
  rsiStable: 18,
  maSupport: 17,
  vixStable: 15,
  cnnFriendly: 12,
  volumeDown: -12,
  rsiOverheat: -10,
  volatilityUp: -12,
  trendSlowdown: -8,
  nearTarget: -9,
}

/** @param {unknown} v */
function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * @param {{
 *   position: TradingZonePosition
 *   panicData?: object | null
 *   activeAux?: Set<string>
 * }} input
 */
export function buildTradingConfidenceBreakdown({ position, panicData = null, activeAux = new Set() }) {
  const entries = []
  const push = (kind, label, score) => entries.push({ kind, label, score })

  const fg = toNum(panicData?.fearGreed)
  const vix = toNum(panicData?.vix)
  const historyLen = position.stageHistory?.length ?? 0

  if (historyLen >= 3) push("positive", "거래량 증가", CONFIDENCE_WEIGHT_TABLE.volumeUp)
  else push("negative", "거래량 감소", CONFIDENCE_WEIGHT_TABLE.volumeDown)

  if (activeAux.has("RSI")) push("positive", "RSI 안정", CONFIDENCE_WEIGHT_TABLE.rsiStable)
  if (activeAux.has("20MA")) push("positive", "20MA 지지", CONFIDENCE_WEIGHT_TABLE.maSupport)

  if (vix != null && vix < 22) push("positive", "VIX 안정", CONFIDENCE_WEIGHT_TABLE.vixStable)
  else if (vix != null && vix >= 28) push("negative", "변동성 확대", CONFIDENCE_WEIGHT_TABLE.volatilityUp)

  if (fg != null && fg >= 45 && fg <= 72) push("positive", "CNN 우호", CONFIDENCE_WEIGHT_TABLE.cnnFriendly)
  if (fg != null && fg >= 80) push("negative", "RSI 과열", CONFIDENCE_WEIGHT_TABLE.rsiOverheat)

  if (position.stage === "trend" && historyLen <= 2) {
    push("negative", "추세 둔화", CONFIDENCE_WEIGHT_TABLE.trendSlowdown)
  }
  if (position.stage === "takeProfit") {
    push("negative", "목표 근접", CONFIDENCE_WEIGHT_TABLE.nearTarget)
  }

  const raw = entries.reduce((acc, e) => acc + e.score, 40)
  const score = Math.max(30, Math.min(95, raw))
  const level = score >= 78 ? "높음" : score >= 60 ? "보통" : "낮음"

  const positives = entries.filter((e) => e.score > 0).map((e) => e.label)
  const negatives = entries.filter((e) => e.score < 0).map((e) => e.label)
  const actionReasonText =
    positives.length >= negatives.length
      ? `현재 분할 진입 가능 이유: ${positives.slice(0, 3).join(", ")}`
      : `현재 추격 비추천 이유: ${negatives.slice(0, 3).join(", ")}`

  return { score, level, entries, actionReasonText }
}

