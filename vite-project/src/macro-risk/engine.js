import { buildBondCollectionMeta } from "./bondCollectionMeta.js"
import { buildDevValidation } from "./devValidation.js"
import { buildLiveDataStatus } from "./liveDataStatus.js"
import { buildNormalizeLayer } from "./normalizeLayer.js"
import { buildRawLayer } from "./rawLayer.js"
import { buildTieredMetrics } from "./metricTiers.js"
import { buildMarketImpact } from "./marketImpact.js"
import { buildMarketRegime } from "./regimeEngine.js"
import { scoreInflationPressure, scoreLiquidity, scoreRatePressure } from "./pillars.js"
import { buildCompatPillars, computeMacroRiskScore } from "./scoreEngine.js"
import { buildYieldCurve } from "./yieldCurve.js"
import { scoreEmoji } from "./seriesMath.js"
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
 * @property {import('./regimeEngine.js').MarketRegimeRow[]} marketRegime
 * @property {{ tier1: import('./displayMetrics.js').MetricDisplayRow[]; tier2: import('./displayMetrics.js').MetricDisplayRow[] }} tieredMetrics
 * @property {import('./yieldCurve.js').ReturnType<buildYieldCurve>} yieldCurve
 * @property {import('./devValidation.js').DevValidationPayload|null} [devValidation]
 * @property {import('./liveDataStatus.js').LiveDataStatusPayload} liveDataStatus
 * @property {NonNullable<ReturnType<computeMacroRiskScore>['breakdown']>} scoreBreakdown
 * @property {string} updatedAt
 * @property {string|null} [bondAsOfNy]
 * @property {import('./bondCollectionMeta.js').BondCollectionMeta} bondCollection
 */

/**
 * @param {Record<string, number[]>} [apiHistory]
 * @param {object | null} [panicContext] read-only
 * @param {{ sources?: Record<string, string>; includeDev?: boolean }} [meta]
 * @returns {MacroRiskSnapshot}
 */
export function buildMacroRiskSnapshot(apiHistory = {}, panicContext = null, meta = {}) {
  const raw = buildRawLayer(apiHistory)
  const normalized = buildNormalizeLayer(raw)
  const triggers = evaluateCompositeTriggers(raw, normalized, panicContext)
  const scored = computeMacroRiskScore(normalized, triggers)
  const score = scored.score
  const marketRegime = buildMarketRegime(normalized, triggers, score)
  const compat = buildCompatPillars(normalized)
  const pillars = [scoreRatePressure(raw), scoreInflationPressure(raw), scoreLiquidity(raw)]

  const activeTriggers = triggers.filter((t) => t.active)
  const headline =
    activeTriggers.find((t) => t.id === "rate_repricing_event")?.label ??
    activeTriggers.find((t) => t.id === "rate_shock")?.label ??
    activeTriggers.find((t) => t.id === "dollar_pressure")?.label ??
    activeTriggers.find((t) => t.id === "liquidity_easing")?.label ??
    (scored.band === "위험" ? "고위험 매크로 구간" : scored.band === "경계" ? "리스크 경계 구간" : `${scored.band} 구간`)
  const subheadline = `채권 보조 ${scored.band} · 핵심 ${scored.tier1Score} / 전문가 ${scored.tier2Score}`

  const rateP = pillars.find((p) => p.id === "rate")
  const infP = pillars.find((p) => p.id === "inflation")
  const liqP = pillars.find((p) => p.id === "liquidity")
  const pillarChips = [
    { key: "rate", label: "금리압력", emoji: scoreEmoji(rateP?.score ?? compat.rate), score: rateP?.score ?? compat.rate },
    { key: "inflation", label: "인플레", emoji: scoreEmoji(infP?.score ?? compat.inflation), score: infP?.score ?? compat.inflation },
    { key: "liquidity", label: "유동성", emoji: scoreEmoji(liqP?.score ?? compat.liquidity), score: liqP?.score ?? compat.liquidity },
  ]

  const longTerm = score <= 30 ? "안정" : score <= 60 ? "주의" : score <= 80 ? "경계" : "위험"
  const connectLongTerm = longTerm
  const shortTerm = activeTriggers.length > 0 ? "트리거 주의" : scored.band
  const tactical = activeTriggers.length > 0 ? "보수 접근" : scored.band === "안정" ? "중립 대응" : "리스크 점검"
  const marketImpact = buildMarketImpact(raw, pillars, triggers)
  const yieldCurve = buildYieldCurve(raw)
  const tieredMetrics = buildTieredMetrics(raw, panicContext, meta.sources ?? {})
  const liveDataStatus = buildLiveDataStatus(meta.sources ?? {}, {
    liveFetchOk: meta.liveFetchOk,
    updatedAt: meta.updatedAt,
  })
  const devValidation = meta.includeDev
    ? buildDevValidation(raw, meta.sources ?? {}, apiHistory, yieldCurve, panicContext, {
        liveFetchOk: meta.liveFetchOk,
        updatedAt: meta.updatedAt,
      })
    : null

  const bondCollection = buildBondCollectionMeta(apiHistory, meta.sources ?? {}, {
    errors: meta.bondFetchErrors ?? {},
    liveCount: meta.bondLiveCount ?? 0,
    bondAsOfNy: meta.bondAsOfNy ?? null,
  })

  return {
    score,
    headline,
    subheadline,
    pillarChips,
    pillars,
    triggers,
    longTerm,
    connectLongTerm,
    shortTerm,
    tactical,
    marketImpact,
    marketRegime,
    tieredMetrics,
    yieldCurve,
    devValidation,
    liveDataStatus,
    scoreBreakdown: scored.breakdown,
    updatedAt: meta.updatedAt ?? new Date().toISOString(),
    bondAsOfNy: meta.bondAsOfNy ?? null,
    bondCollection,
  }
}
