import { buildDevValidation } from "./devValidation.js"
import { buildRawLayer } from "./rawLayer.js"
import { buildTieredMetrics } from "./metricTiers.js"
import { buildMarketImpact } from "./marketImpact.js"
import { buildYieldCurve } from "./yieldCurve.js"
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
 * @property {string} connectLongTerm
 * @property {import('./marketImpact.js').MarketImpactRow[]} marketImpact
 * @property {{ tier1: import('./displayMetrics.js').MetricDisplayRow[]; tier2: import('./displayMetrics.js').MetricDisplayRow[] }} tieredMetrics
 * @property {import('./yieldCurve.js').ReturnType<buildYieldCurve>} yieldCurve
 * @property {import('./devValidation.js').ReturnType<buildDevValidation>|null} [devValidation]
 * @property {string} updatedAt
 */

/**
 * @param {Record<string, number[]>} [apiHistory]
 * @param {object | null} [panicContext] read-only
 * @param {{ sources?: Record<string, string>; includeDev?: boolean }} [meta]
 * @returns {MacroRiskSnapshot}
 */
export function buildMacroRiskSnapshot(apiHistory = {}, panicContext = null, meta = {}) {
  const raw = buildRawLayer(apiHistory)
  const rate = scoreRatePressure(raw)
  const inflation = scoreInflationPressure(raw)
  const liquidity = scoreLiquidity(raw)

  const score = clampScore(rate.score * 0.42 + inflation.score * 0.33 + liquidity.score * 0.25)
  const triggers = evaluateCompositeTriggers(raw, panicContext)

  const activeTriggers = triggers.filter((t) => t.active)
  const headline =
    activeTriggers.find((t) => t.id === "long_rate_stress")?.label ??
    activeTriggers.find((t) => t.id === "rate_shock")?.label ??
    (rate.score >= 65 ? "단기 조정 위험" : score >= 55 ? "매크로 중립" : "리스크 완화")
  const subheadline = rate.status || inflation.status

  const pillarChips = [
    { key: "rate", label: "금리압력", emoji: scoreEmoji(rate.score), score: rate.score },
    { key: "inflation", label: "인플레", emoji: scoreEmoji(inflation.score), score: inflation.score },
    { key: "liquidity", label: "유동성", emoji: scoreEmoji(liquidity.score), score: liquidity.score },
  ]

  const longTerm = score < 50 ? "중립 이상" : score < 70 ? "중립" : "방어 우선"
  const connectLongTerm = score < 55 ? "중립" : score < 72 ? "중립" : "방어"
  const shortTerm = rate.score >= 60 ? "금리 압박" : inflation.score >= 55 ? "인플레 주의" : "변동성 관리"
  const tactical =
    activeTriggers.length > 0 ? "보수 접근" : score >= 60 ? "선별 매수" : "분할 대응"
  const marketImpact = buildMarketImpact(raw, [rate, inflation, liquidity], triggers)
  const tieredMetrics = buildTieredMetrics(raw, panicContext, meta.sources ?? {})
  const yieldCurve = buildYieldCurve(raw)
  const devValidation = meta.includeDev ? buildDevValidation(raw, meta.sources ?? {}) : null

  return {
    score,
    headline,
    subheadline,
    pillarChips,
    pillars: [rate, inflation, liquidity],
    triggers,
    longTerm,
    connectLongTerm,
    shortTerm,
    tactical,
    marketImpact,
    tieredMetrics,
    yieldCurve,
    devValidation,
    updatedAt: new Date().toISOString(),
  }
}
