import { formatMetric } from "./ydsHistoricalEventTypes.js"
import { buildPrecursorDashboardBetaReport } from "./ydsPrecursorEnginePhase12.js"
import { buildPrecursorEnginePhase6Report } from "./ydsPrecursorEnginePhase6.js"
import { buildPrecursorEnginePhase15Report } from "./ydsPrecursorEnginePhase15.js"
import { buildPrecursorEnginePhase16Report } from "./ydsPrecursorEnginePhase16.js"
import { resolvePortfolioStageMeta } from "./ydsPrecursorEnginePhase23.js"
import { resolveMacroStageAllocation, MACRO_STAGE_ALLOCATION } from "./macroStageAllocation.js"
import { SECTOR_RADAR_CATALOG } from "./ydsPrecursorEnginePhase25.js"
import { buildSectorRadarFromPrecursorContext } from "./ydsPrecursorEnginePhase25.js"
import { buildStockRadarFromPrecursorContext } from "./ydsPrecursorEnginePhase26.js"
import { buildEntryRadarFromPrecursorContext } from "./ydsPrecursorEnginePhase27.js"
import { buildConvictionEngineFromPrecursorContext } from "./ydsConvictionEngine.js"
import { loadPrecursorValidationLog } from "./ydsPrecursorValidationLogStorage.js"

export const PORTFOLIO_BUILDER_LABEL = "Portfolio Builder — Phase 31"

/** @typedef {'conservative' | 'neutral' | 'aggressive'} PortfolioRiskModeId */

export const PORTFOLIO_RISK_MODES = [
  {
    id: "conservative",
    label: "보수형",
    summary: "종목 수 축소 · 섹터·종목 캡 강화 · 관찰 제외",
    maxPositions: 4,
    maxSingleStockPct: 18,
    maxSectorPct: 32,
    includeWatch: false,
    volatilityFactor: 0.88,
  },
  {
    id: "neutral",
    label: "중립형",
    summary: "Conviction 기준 기본 분산",
    maxPositions: 6,
    maxSingleStockPct: 25,
    maxSectorPct: 45,
    includeWatch: true,
    volatilityFactor: 1,
  },
  {
    id: "aggressive",
    label: "공격형",
    summary: "종목 확대 · 핵심 비중 상향",
    maxPositions: 8,
    maxSingleStockPct: 28,
    maxSectorPct: 55,
    includeWatch: true,
    volatilityFactor: 1.12,
  },
]

/** @type {Record<string, string>} */
const SECTOR_LABEL_BY_ID = Object.fromEntries(SECTOR_RADAR_CATALOG.map((s) => [s.id, s.label]))

/** @type {Record<string, number>} */
const STAGE_VOLATILITY_BASE = {
  overheated: 12,
  neutral: 15,
  interest: 17,
  dca: 20,
  panicBuy: 24,
}

/** @type {Record<import("./ydsConvictionEngine.js").ConvictionTierId, number>} */
const TIER_PICK_PRIORITY = { core: 0, main: 1, watch: 2, exclude: 9 }

export const PORTFOLIO_BUILDER_PIPELINE = [
  { id: "market-position", label: "시장 위치", status: "active" },
  { id: "action-guide", label: "행동 단계", status: "active" },
  { id: "sector-radar", label: "Sector Radar", status: "active" },
  { id: "stock-radar", label: "Stock Radar", status: "active" },
  { id: "entry-radar", label: "Entry Radar", status: "active" },
  { id: "conviction-engine", label: "Conviction Engine", status: "active" },
  { id: "portfolio-builder", label: "Portfolio Builder", status: "active", outputKey: "topPortfolio" },
  { id: "paper-trading", label: "Paper Trading", status: "planned", consumes: "portfolioBuilder.holdings" },
  { id: "performance-dashboard", label: "Performance Dashboard", status: "planned" },
  { id: "live-account", label: "실전 계좌 공개", status: "planned" },
]

/**
 * @param {string | null | undefined} sectorRadarId
 */
export function resolvePortfolioSectorLabel(sectorRadarId) {
  if (!sectorRadarId) return "기타"
  return SECTOR_LABEL_BY_ID[sectorRadarId] ?? sectorRadarId
}

/**
 * @param {PortfolioRiskModeId} modeId
 */
export function resolvePortfolioRiskMode(modeId = "neutral") {
  return PORTFOLIO_RISK_MODES.find((m) => m.id === modeId) ?? PORTFOLIO_RISK_MODES[1]
}

/**
 * @param {ReturnType<typeof buildConvictionEngineFromPrecursorContext>["activeConvictions"]} candidates
 * @param {ReturnType<typeof resolvePortfolioRiskMode>} risk
 */
function selectPortfolioCandidates(candidates, risk) {
  const pool = candidates
    .filter((c) => {
      if (c.tier.id === "exclude") return false
      if (!risk.includeWatch && c.tier.id === "watch") return false
      return (c.recommendedWeightPct ?? 0) > 0
    })
    .sort((a, b) => {
      const tp = TIER_PICK_PRIORITY[a.tier.id] - TIER_PICK_PRIORITY[b.tier.id]
      if (tp !== 0) return tp
      return b.convictionScore - a.convictionScore
    })

  /** @type {typeof pool} */
  const picked = []
  /** @type {Record<string, number>} */
  const sectorUsed = {}

  for (const row of pool) {
    if (picked.length >= risk.maxPositions) break
    const sectorKey = row.sectorRadarId ?? "other"
    const sectorSum = sectorUsed[sectorKey] ?? 0
    if (picked.length > 0 && sectorSum >= risk.maxSectorPct) continue
    picked.push(row)
    sectorUsed[sectorKey] = sectorSum + 1
  }

  return picked
}

/**
 * @param {ReturnType<typeof selectPortfolioCandidates>} picked
 * @param {number} stockSleevePct
 * @param {ReturnType<typeof resolvePortfolioRiskMode>} risk
 */
function allocatePortfolioWeights(picked, stockSleevePct, risk) {
  if (!picked.length || stockSleevePct <= 0) return []

  const tierMul = { core: 1.35, main: 1, watch: 0.65 }
  const raw = picked.map((r) => (r.convictionScore ?? 0) * (tierMul[r.tier.id] ?? 0.5))
  const rawSum = raw.reduce((a, b) => a + b, 0) || 1

  let weights = raw.map((w) => (w / rawSum) * stockSleevePct)

  const capSingle = risk.maxSingleStockPct
  let changed = true
  while (changed) {
    changed = false
    let overflow = 0
    let freeIdx = []
    weights = weights.map((w, i) => {
      if (w > capSingle) {
        overflow += w - capSingle
        changed = true
        return capSingle
      }
      freeIdx.push(i)
      return w
    })
    if (overflow > 0 && freeIdx.length) {
      const add = overflow / freeIdx.length
      weights = weights.map((w, i) => (w >= capSingle - 0.01 ? w : w + add))
    }
  }

  /** @type {Record<string, number>} */
  const sectorTotals = {}
  for (let i = 0; i < picked.length; i++) {
    const sk = picked[i].sectorRadarId ?? "other"
    sectorTotals[sk] = (sectorTotals[sk] ?? 0) + weights[i]
  }
  for (const [sk, total] of Object.entries(sectorTotals)) {
    if (total <= risk.maxSectorPct) continue
    const scale = risk.maxSectorPct / total
    for (let i = 0; i < picked.length; i++) {
      if ((picked[i].sectorRadarId ?? "other") === sk) weights[i] *= scale
    }
  }

  const wSum = weights.reduce((a, b) => a + b, 0)
  if (wSum > 0 && Math.abs(wSum - stockSleevePct) > 0.05) {
    const scale = stockSleevePct / wSum
    weights = weights.map((w) => w * scale)
  }

  return picked.map((row, i) => {
    const pct = Math.round(weights[i] * 10) / 10
    return {
      id: row.id,
      name: row.name,
      symbol: row.symbol,
      code: row.code,
      market: row.market,
      marketLabel: row.marketLabel,
      sectorId: row.sectorRadarId,
      sectorLabel: resolvePortfolioSectorLabel(row.sectorRadarId),
      score: row.score,
      entryGrade: row.entryGrade,
      convictionScore: row.convictionScore,
      convictionDisplay: row.convictionDisplay,
      stars: row.stars,
      tierId: row.tier.id,
      tierLabel: row.tier.label,
      weightPct: pct,
      weightDisplay: `${formatMetric(pct, 1)}%`,
      status: row.status,
    }
  })
}

/**
 * @param {ReturnType<typeof allocatePortfolioWeights>} holdings
 */
function buildSectorBreakdown(holdings) {
  /** @type {Record<string, { sectorId: string; label: string; weightPct: number; count: number }>} */
  const map = {}
  for (const h of holdings) {
    const key = h.sectorId ?? "other"
    if (!map[key]) {
      map[key] = { sectorId: key, label: h.sectorLabel, weightPct: 0, count: 0 }
    }
    map[key].weightPct += h.weightPct
    map[key].count += 1
  }
  return Object.values(map)
    .map((s) => ({
      ...s,
      weightPct: Math.round(s.weightPct * 10) / 10,
      weightDisplay: `${formatMetric(s.weightPct, 1)}%`,
    }))
    .sort((a, b) => b.weightPct - a.weightPct)
}

/**
 * @param {string | null} stageId
 * @param {PortfolioRiskModeId} riskMode
 * @param {number} holdingCount
 * @param {number} avgConviction
 */
function estimateExpectedVolatility(stageId, riskMode, holdingCount, avgConviction) {
  const base = STAGE_VOLATILITY_BASE[/** @type {string} */ (stageId)] ?? 16
  const risk = resolvePortfolioRiskMode(riskMode)
  const diversifyAdj = holdingCount >= 5 ? -1.5 : holdingCount <= 2 ? 2.5 : 0
  const convictionAdj = avgConviction >= 85 ? -1 : avgConviction < 60 ? 2 : 0
  const vol = (base + diversifyAdj + convictionAdj) * risk.volatilityFactor
  return Math.round(Math.max(8, Math.min(35, vol)) * 10) / 10
}

/**
 * @param {{
 *   sectorRadar: ReturnType<typeof buildSectorRadarFromPrecursorContext>
 *   stockRadar: ReturnType<typeof buildStockRadarFromPrecursorContext>
 *   entryRadar: ReturnType<typeof buildEntryRadarFromPrecursorContext>
 *   convictionEngine: ReturnType<typeof buildConvictionEngineFromPrecursorContext>
 *   actionGuide?: { current?: { label?: string; emoji?: string }; currentStageId?: string | null; oneLiner?: string }
 *   riskMode?: PortfolioRiskModeId
 * }} ctx
 */
export function buildPortfolioBuilderFromPrecursorContext(ctx) {
  const riskMode = ctx.riskMode ?? "neutral"
  const risk = resolvePortfolioRiskMode(riskMode)
  const stageId = ctx.sectorRadar.exportForStockRadar?.stageId ?? null
  const stageMeta = resolvePortfolioStageMeta(stageId)
  const allocation = resolveMacroStageAllocation(stageId)
  const stockSleevePct = allocation?.stockPct ?? 0
  const cashPct = allocation?.cashPct ?? 100

  const picked = selectPortfolioCandidates(ctx.convictionEngine.activeConvictions ?? [], risk)
  const holdings = allocatePortfolioWeights(picked, stockSleevePct, risk)
  const sectorBreakdown = buildSectorBreakdown(holdings)

  const avgConviction =
    holdings.length > 0
      ? Math.round(
          (holdings.reduce((s, h) => s + h.convictionScore, 0) / holdings.length) * 10,
        ) / 10
      : 0

  const expectedVolatilityPct = estimateExpectedVolatility(
    stageId,
    riskMode,
    holdings.length,
    avgConviction,
  )

  const stageAllocationTable = Object.entries(MACRO_STAGE_ALLOCATION).map(([id, alloc]) => {
    const meta = resolvePortfolioStageMeta(id)
    return {
      stageId: id,
      emoji: meta?.emoji ?? "⚪",
      shortLabel: meta?.shortLabel ?? id,
      stockPct: alloc.stockPct,
      cashPct: alloc.cashPct,
      stockLabel: alloc.stockLabel,
      cashLabel: alloc.cashLabel,
      active: stageId === id,
    }
  })

  return {
    label: PORTFOLIO_BUILDER_LABEL,
    title: "추천 포트폴리오",
    available: ctx.convictionEngine.available && holdings.length > 0 && Boolean(allocation),
    asOf: ctx.convictionEngine.asOf,
    riskMode,
    riskModeLabel: risk.label,
    riskModeSummary: risk.summary,
    riskModes: PORTFOLIO_RISK_MODES,
    stage: stageMeta
      ? {
          id: stageMeta.id,
          emoji: stageMeta.emoji,
          shortLabel: stageMeta.shortLabel,
          label: stageMeta.label,
          display: `${stageMeta.emoji} ${stageMeta.shortLabel}`,
        }
      : null,
    actionGuide: {
      label: ctx.actionGuide?.current?.label ?? "—",
      emoji: ctx.actionGuide?.current?.emoji ?? "",
      oneLiner: ctx.actionGuide?.oneLiner ?? "",
      stageId: ctx.actionGuide?.currentStageId ?? stageId,
    },
    allocation: allocation
      ? {
          stockPct: allocation.stockPct ?? 0,
          cashPct: allocation.cashPct ?? 100,
          stockLabel: allocation.stockLabel,
          cashLabel: allocation.cashLabel,
          summary: `${allocation.stockLabel} · ${allocation.cashLabel}`,
        }
      : null,
    stageAllocationTable,
    topPortfolio: holdings,
    sectorBreakdown,
    summary: {
      holdingCount: holdings.length,
      stockSleeveDisplay: allocation?.stockLabel ?? "—",
      cashDisplay: allocation?.cashLabel ?? "—",
      sectorCount: sectorBreakdown.length,
      expectedVolatilityDisplay: `${formatMetric(expectedVolatilityPct, 1)}%`,
      expectedVolatilityPct,
      avgConviction,
    },
    inputs: {
      marketPosition: ctx.convictionEngine.inputs?.marketPosition,
      convictionCount: ctx.convictionEngine.activeConvictions?.length ?? 0,
      stockRadarCount: ctx.stockRadar.topBuys?.length ?? 0,
      entryRadarCount: ctx.entryRadar.tradeCandidates?.length ?? 0,
      topSectorLabels: ctx.sectorRadar.topSectors?.slice(0, 3).map((s) => s.label) ?? [],
    },
    pipeline: PORTFOLIO_BUILDER_PIPELINE,
    exportForPaperTrading: {
      version: 1,
      asOf: ctx.convictionEngine.asOf,
      riskMode,
      stageId,
      stockSleevePct,
      cashPct,
      holdings: holdings.map((h) => ({
        id: h.id,
        symbol: h.symbol,
        name: h.name,
        weightPct: h.weightPct,
        entryGrade: h.entryGrade,
        convictionScore: h.convictionScore,
      })),
    },
    notes: [
      "행동 단계별 현금·주식 비중은 macroStageAllocation 고정",
      "종목 비중 = 주식 슬리브 내 Conviction·리스크 모드 분산",
      "YDS 엔진 미수정 · exportForPaperTrading → Paper Trading 연결 예정",
    ],
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 * @param {{ latestSnapshot?: Record<string, unknown> | null; extraRows?: object[]; riskMode?: PortfolioRiskModeId }} [options]
 */
export function buildPortfolioBuilderReport(events, options = {}) {
  const engineOptions = {
    latestSnapshot: options.latestSnapshot ?? null,
    extraRows: options.extraRows ?? [],
    log: loadPrecursorValidationLog(),
  }
  const dashboard = buildPrecursorDashboardBetaReport(events, engineOptions)
  const phase6 = buildPrecursorEnginePhase6Report(events, engineOptions)
  const action = buildPrecursorEnginePhase15Report(events, engineOptions)
  const confidenceReport = buildPrecursorEnginePhase16Report(events, engineOptions)
  const sectorRadar = buildSectorRadarFromPrecursorContext({
    dashboard,
    phase6,
    latestSnapshot: options.latestSnapshot ?? null,
  })
  const stockRadar = buildStockRadarFromPrecursorContext({ dashboard, phase6, sectorRadar })
  const entryRadar = buildEntryRadarFromPrecursorContext({ dashboard, phase6, sectorRadar, stockRadar })
  const convictionEngine = buildConvictionEngineFromPrecursorContext({
    sectorRadar,
    stockRadar,
    entryRadar,
    confidence: {
      score: confidenceReport.confidence.score,
      label: confidenceReport.confidence.label?.label ?? "—",
    },
  })

  return buildPortfolioBuilderFromPrecursorContext({
    sectorRadar,
    stockRadar,
    entryRadar,
    convictionEngine,
    actionGuide: {
      current: action.currentAction,
      currentStageId: sectorRadar.exportForStockRadar?.stageId ?? null,
      oneLiner: action.oneLiner,
    },
    riskMode: options.riskMode ?? "neutral",
  })
}
