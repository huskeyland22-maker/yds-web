import { formatMetric } from "./ydsHistoricalEventTypes.js"
import { buildPrecursorDashboardBetaReport } from "./ydsPrecursorEnginePhase12.js"
import { buildPrecursorEnginePhase6Report } from "./ydsPrecursorEnginePhase6.js"
import { buildPrecursorEnginePhase16Report } from "./ydsPrecursorEnginePhase16.js"
import { buildSectorRadarFromPrecursorContext } from "./ydsPrecursorEnginePhase25.js"
import { buildStockRadarFromPrecursorContext } from "./ydsPrecursorEnginePhase26.js"
import { buildEntryRadarFromPrecursorContext } from "./ydsPrecursorEnginePhase27.js"
import { loadPrecursorValidationLog } from "./ydsPrecursorValidationLogStorage.js"

export const CONVICTION_ENGINE_LABEL = "Conviction Engine — Phase 30"

/** @typedef {'core' | 'main' | 'watch' | 'exclude'} ConvictionTierId */

export const CONVICTION_SCORE_WEIGHTS = {
  entryScore: 0.3,
  stockScore: 0.25,
  sectorStrength: 0.15,
  marketPosition: 0.15,
  confidence: 0.15,
}

export const CONVICTION_TIER_BANDS = [
  { id: "core", min: 90, label: "핵심 포지션", summary: "확신도 90+" },
  { id: "main", min: 70, max: 89, label: "주력 포지션", summary: "확신도 70~89" },
  { id: "watch", min: 50, max: 69, label: "관찰 포지션", summary: "확신도 50~69" },
  { id: "exclude", max: 49, label: "제외", summary: "확신도 50 미만" },
]

/** @type {Record<string, number>} */
const STAGE_MARKET_POSITION = {
  overheated: 52,
  neutral: 78,
  interest: 74,
  dca: 86,
  panicBuy: 90,
}

/** @type {Record<import("./ydsPrecursorEnginePhase27.js").EntryGradeId, number>} */
const GRADE_CONVICTION_CAP = {
  A: 98,
  B: 92,
  C: 68,
  D: 48,
}

/** @type {Record<import("./ydsPrecursorEnginePhase27.js").EntryGradeId, number>} */
const GRADE_CONVICTION_MUL = {
  A: 1.04,
  B: 1,
  C: 0.9,
  D: 0.72,
}

/** @type {Record<ConvictionTierId, number>} */
const TIER_WEIGHT_MULTIPLIER = {
  core: 1.45,
  main: 1,
  watch: 0.52,
  exclude: 0,
}

export const CONVICTION_ENGINE_PIPELINE = [
  { id: "stock-radar", label: "Stock Radar", status: "active" },
  { id: "entry-radar", label: "Entry Radar", status: "active" },
  { id: "sector-radar", label: "Sector Radar", status: "active" },
  { id: "market-position", label: "시장 위치", status: "active" },
  { id: "confidence", label: "신뢰도", status: "active" },
  { id: "conviction-engine", label: "Conviction Engine", status: "active", outputKey: "convictions" },
  { id: "portfolio-builder", label: "Portfolio Builder", status: "active", consumes: "convictionEngine.allocations" },
  { id: "live-account", label: "실전 계좌", status: "planned", consumes: "portfolioBuilder.orders" },
]

/**
 * @param {number} raw
 */
function clampConviction(raw) {
  return Math.max(0, Math.min(100, Math.round(raw * 10) / 10))
}

/**
 * @param {number} score
 * @returns {ConvictionTierId}
 */
export function resolveConvictionTier(score) {
  if (score >= 90) return "core"
  if (score >= 70) return "main"
  if (score >= 50) return "watch"
  return "exclude"
}

/**
 * @param {ConvictionTierId} tierId
 */
export function resolveConvictionTierMeta(tierId) {
  return CONVICTION_TIER_BANDS.find((b) => b.id === tierId) ?? CONVICTION_TIER_BANDS[3]
}

/**
 * @param {number} score
 */
export function formatConvictionStars(score) {
  let filled = 1
  if (score >= 90) filled = 5
  else if (score >= 70) filled = 4
  else if (score >= 50) filled = 3
  else if (score >= 35) filled = 2

  const empty = 5 - filled
  const display = "★".repeat(filled) + "☆".repeat(empty)
  return {
    filled,
    empty,
    display,
    ariaLabel: `확신도 ${formatMetric(score, 0)}점 · ${filled}점 만점 중 ${filled}`,
  }
}

/**
 * @param {ReturnType<typeof buildSectorRadarFromPrecursorContext>} sectorRadar
 * @param {string | null | undefined} sectorRadarId
 */
function resolveSectorStrengthScore(sectorRadar, sectorRadarId) {
  const hit = (sectorRadar.topSectors ?? []).find((s) => s.id === sectorRadarId)
  return hit?.score ?? 52
}

/**
 * @param {{
 *   sectorRadar: ReturnType<typeof buildSectorRadarFromPrecursorContext>
 *   stockRadar: ReturnType<typeof buildStockRadarFromPrecursorContext>
 *   entryRadar: ReturnType<typeof buildEntryRadarFromPrecursorContext>
 *   confidence: { score: number; label: string; tone?: string }
 * }} ctx
 */
export function buildConvictionEngineFromPrecursorContext(ctx) {
  const { sectorRadar, stockRadar, entryRadar, confidence } = ctx
  const stageId = sectorRadar.exportForStockRadar?.stageId ?? null
  const marketPositionScore = STAGE_MARKET_POSITION[/** @type {string} */ (stageId)] ?? 70
  const confidenceScore = confidence?.score ?? 70

  const rows = (entryRadar.tradeCandidates ?? []).map((c) => {
    const sectorStrength = resolveSectorStrengthScore(sectorRadar, c.sectorRadarId)
    const gradeId = c.grade.id

    const blended =
      (c.entryScore ?? 0) * CONVICTION_SCORE_WEIGHTS.entryScore +
      (c.score ?? 0) * CONVICTION_SCORE_WEIGHTS.stockScore +
      sectorStrength * CONVICTION_SCORE_WEIGHTS.sectorStrength +
      marketPositionScore * CONVICTION_SCORE_WEIGHTS.marketPosition +
      confidenceScore * CONVICTION_SCORE_WEIGHTS.confidence

    let convictionScore = clampConviction(blended * (GRADE_CONVICTION_MUL[gradeId] ?? 1))
    convictionScore = Math.min(convictionScore, GRADE_CONVICTION_CAP[gradeId] ?? 98)

    const tierId = resolveConvictionTier(convictionScore)
    const tier = resolveConvictionTierMeta(tierId)
    const stars = formatConvictionStars(convictionScore)

    return {
      id: c.id,
      name: c.name,
      symbol: c.symbol,
      code: c.code,
      market: c.market,
      marketLabel: c.marketLabel,
      score: c.score,
      entryScore: c.entryScore,
      entryGrade: gradeId,
      entryGradeLabel: c.grade.label,
      entryAction: c.grade.action,
      status: c.status,
      sectorRadarId: c.sectorRadarId,
      convictionScore,
      convictionDisplay: formatConvictionScore(convictionScore),
      tier: {
        id: tierId,
        label: tier.label,
        summary: tier.summary,
      },
      stars,
      recommendedWeightPct: null,
      recommendedWeightDisplay: "—",
      scoreBreakdown: {
        entryScore: c.entryScore,
        stockScore: c.score,
        sectorStrength,
        marketPosition: marketPositionScore,
        confidence: confidenceScore,
        weights: CONVICTION_SCORE_WEIGHTS,
      },
      excluded: tierId === "exclude",
    }
  })

  const included = rows.filter((r) => !r.excluded)
  const weightRaw = included.map((r) => r.convictionScore * (TIER_WEIGHT_MULTIPLIER[r.tier.id] ?? 0))
  const weightSum = weightRaw.reduce((a, b) => a + b, 0)

  for (const row of rows) {
    if (row.excluded || weightSum <= 0) continue
    const idx = included.findIndex((r) => r.id === row.id)
    if (idx < 0) continue
    const pct = Math.round((weightRaw[idx] / weightSum) * 1000) / 10
    row.recommendedWeightPct = pct
    row.recommendedWeightDisplay = `${formatMetric(pct, 1)}%`
  }

  const byTier = {
    core: rows.filter((r) => r.tier.id === "core"),
    main: rows.filter((r) => r.tier.id === "main"),
    watch: rows.filter((r) => r.tier.id === "watch"),
    exclude: rows.filter((r) => r.tier.id === "exclude"),
  }

  const activeWeightSum = included.reduce((s, r) => s + (r.recommendedWeightPct ?? 0), 0)

  return {
    label: CONVICTION_ENGINE_LABEL,
    title: "확신도 · 추천 비중",
    available: entryRadar.available && rows.length > 0,
    asOf: entryRadar.asOf ?? stockRadar.asOf ?? sectorRadar.asOf,
    scoreWeights: CONVICTION_SCORE_WEIGHTS,
    scoreWeightsDisplay:
      "Entry 30% · Stock 25% · Sector 15% · 시장위치 15% · 신뢰도 15%",
    tierBands: CONVICTION_TIER_BANDS,
    convictions: rows,
    activeConvictions: included,
    byTier,
    summary: {
      total: rows.length,
      core: byTier.core.length,
      main: byTier.main.length,
      watch: byTier.watch.length,
      excluded: byTier.exclude.length,
      weightAllocatedDisplay:
        activeWeightSum > 0 ? `${formatMetric(activeWeightSum, 1)}%` : "—",
    },
    inputs: {
      marketPosition: {
        stageId,
        label: sectorRadar.currentMarket?.display ?? "—",
        score: marketPositionScore,
      },
      confidence: {
        score: confidenceScore,
        label: confidence?.label ?? "—",
      },
      stockRadarCount: stockRadar.topBuys?.length ?? 0,
      entryRadarCount: entryRadar.tradeCandidates?.length ?? 0,
      sectorTopIds: sectorRadar.topSectors?.map((s) => s.id) ?? [],
    },
    pipeline: CONVICTION_ENGINE_PIPELINE,
    exportForPortfolioBuilder: {
      version: 1,
      asOf: entryRadar.asOf ?? null,
      allocations: included.map((r) => ({
        id: r.id,
        symbol: r.symbol,
        name: r.name,
        entryGrade: r.entryGrade,
        convictionScore: r.convictionScore,
        tierId: r.tier.id,
        weightPct: r.recommendedWeightPct,
      })),
    },
    notes: [
      "Stock·Entry·Sector Radar + 시장 위치 + 신뢰도 읽기 전용 집약",
      "확신도·추천 비중 자동 산출 · YDS 엔진 미수정",
      "exportForPortfolioBuilder → Phase 31 Portfolio Builder",
    ],
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 * @param {{ latestSnapshot?: Record<string, unknown> | null; extraRows?: object[] }} [options]
 */
export function buildConvictionEngineReport(events, options = {}) {
  const engineOptions = {
    latestSnapshot: options.latestSnapshot ?? null,
    extraRows: options.extraRows ?? [],
    log: loadPrecursorValidationLog(),
  }
  const dashboard = buildPrecursorDashboardBetaReport(events, engineOptions)
  const phase6 = buildPrecursorEnginePhase6Report(events, engineOptions)
  const confidenceReport = buildPrecursorEnginePhase16Report(events, engineOptions)
  const sectorRadar = buildSectorRadarFromPrecursorContext({
    dashboard,
    phase6,
    latestSnapshot: options.latestSnapshot ?? null,
  })
  const stockRadar = buildStockRadarFromPrecursorContext({ dashboard, phase6, sectorRadar })
  const entryRadar = buildEntryRadarFromPrecursorContext({ dashboard, phase6, sectorRadar, stockRadar })

  return buildConvictionEngineFromPrecursorContext({
    sectorRadar,
    stockRadar,
    entryRadar,
    confidence: {
      score: confidenceReport.confidence.score,
      label: confidenceReport.confidence.label?.label ?? "—",
      tone: confidenceReport.confidence.label?.tone,
    },
  })
}

export function formatConvictionScore(value) {
  if (value == null || !Number.isFinite(value)) return "—"
  return formatMetric(value, 0)
}
