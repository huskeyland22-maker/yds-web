import { buildRawLayer } from "./rawLayer.js"
import { scoreInflationPressure, scoreLiquidity, scoreRatePressure } from "./pillars.js"
import { clampScore, scoreEmoji } from "./seriesMath.js"
import { evaluateCompositeTriggers } from "./triggers.js"

/**
 * @typedef {Object} MacroRiskSnapshot
 * @property {number} score
 * @property {string} headline
 * @property {string} subheadline
 * @property {{ key: string; label: string; emoji: string; score: number }[]} pillarChips
 * @property {ReturnType<scoreRatePressure>[]} pillars
 * @property {ReturnType<evaluateCompositeTriggers>} triggers
 * @property {string} longTerm
 * @property {string} shortTerm
 * @property {string} tactical
 * @property {string} updatedAt
 */

/**
 * @param {Record<string, number[]>} [apiHistory]
 * @param {object | null} [panicContext] read-only
 * @returns {MacroRiskSnapshot}
 */
export function buildMacroRiskSnapshot(apiHistory = {}, panicContext = null) {
  const raw = buildRawLayer(apiHistory)
  const rate = scoreRatePressure(raw)
  const inflation = scoreInflationPressure(raw)
  const liquidity = scoreLiquidity(raw)

  const score = clampScore(rate.score * 0.42 + inflation.score * 0.33 + liquidity.score * 0.25)
  const triggers = evaluateCompositeTriggers(raw, panicContext)

  const activeTriggers = triggers.filter((t) => t.active)
  const headline =
    activeTriggers.find((t) => t.id === "rate_shock")?.label ??
    (rate.score >= 65 ? "단기 조정 위험" : score >= 55 ? "매크로 중립" : "리스크 완화")
  const subheadline = rate.status || inflation.status

  const pillarChips = [
    { key: "rate", label: "금리압력", emoji: scoreEmoji(rate.score), score: rate.score },
    { key: "inflation", label: "인플레", emoji: scoreEmoji(inflation.score), score: inflation.score },
    { key: "liquidity", label: "유동성", emoji: scoreEmoji(liquidity.score), score: liquidity.score },
  ]

  const longTerm = score < 50 ? "중립 이상" : score < 70 ? "중립" : "방어 우선"
  const shortTerm = rate.score >= 60 ? "금리 압박" : inflation.score >= 55 ? "인플레 주의" : "변동성 관리"
  const tactical =
    activeTriggers.length > 0 ? "보수 접근" : score >= 60 ? "선별 매수" : "분할 대응"

  return {
    score,
    headline,
    subheadline,
    pillarChips,
    pillars: [rate, inflation, liquidity],
    triggers,
    longTerm,
    shortTerm,
    tactical,
    updatedAt: new Date().toISOString(),
  }
}
