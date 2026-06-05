import { formatMetric } from "./ydsHistoricalEventTypes.js"
import { buildPrecursorDashboardBetaReport } from "./ydsPrecursorEnginePhase12.js"
import { buildPrecursorEnginePhase6Report } from "./ydsPrecursorEnginePhase6.js"
import { buildSectorRadarFromPrecursorContext } from "./ydsPrecursorEnginePhase25.js"
import { buildStockRadarFromPrecursorContext } from "./ydsPrecursorEnginePhase26.js"
import { loadPrecursorValidationLog } from "./ydsPrecursorValidationLogStorage.js"

export const PRECURSOR_ENGINE_PHASE27_LABEL = "Entry Radar — Phase 27"

/** @typedef {'A' | 'B' | 'C' | 'D'} EntryGradeId */
/** @typedef {'strong' | 'dip' | 'breakout' | 'watch'} StockRadarStatusId */

export const ENTRY_RADAR_SCORE_WEIGHTS = {
  marketFit: 0.3,
  stockScore: 0.3,
  technicalStatus: 0.3,
  risk: 0.1,
}

/** @type {Record<EntryGradeId, { label: string; summary: string; bullets: string[] }>} */
export const ENTRY_GRADE_DEFINITIONS = {
  A: {
    label: "A",
    summary: "분할진입 가능 · 리스크 낮음 · 현재 구간 매력적",
    bullets: ["분할진입 가능", "리스크 낮음", "현재 구간 매력적"],
  },
  B: {
    label: "B",
    summary: "관심 유지 · 소액 진입 가능",
    bullets: ["관심 유지", "소액 진입 가능"],
  },
  C: {
    label: "C",
    summary: "추격 위험 · 눌림 대기",
    bullets: ["추격 위험", "눌림 대기"],
  },
  D: {
    label: "D",
    summary: "관찰만 · 진입 금지",
    bullets: ["관찰만", "진입 금지"],
  },
}

/** @type {Record<EntryGradeId, string>} */
export const ENTRY_GRADE_DEFAULT_ACTION = {
  A: "분할진입 가능",
  B: "관심 유지",
  C: "눌림 대기",
  D: "관찰만",
}

/** @type {Record<StockRadarStatusId, number>} */
const TECHNICAL_STATUS_SCORE = {
  breakout: 92,
  dip: 88,
  strong: 72,
  watch: 48,
}

/** @type {Record<EntryGradeId, number>} */
const GRADE_ORDER = { A: 0, B: 1, C: 2, D: 3 }

/** @type {Record<string, number>} */
const STAGE_MARKET_FIT = {
  overheated: 52,
  neutral: 78,
  interest: 74,
  dca: 86,
  panicBuy: 90,
}

/** @type {Record<string, number>} */
const RADAR_RISK_PENALTY = {
  normal: 0,
  caution: 8,
  danger: 18,
  critical: 32,
}

/** @type {Record<string, number>} */
const REGIME_RISK_PENALTY = {
  stable: 0,
  transition: 4,
  risk: 12,
  panic: 6,
  unknown: 8,
}

export const ENTRY_RADAR_PIPELINE = [
  { id: "entry-radar", label: "진입 신호", status: "active", outputKey: "tradeCandidates" },
  {
    id: "conviction-engine",
    label: "Conviction Engine",
    status: "active",
    consumes: "entryRadar.tradeCandidates",
  },
  {
    id: "portfolio-builder",
    label: "Portfolio Builder",
    status: "active",
    consumes: "convictionEngine.allocations",
  },
  {
    id: "paper-trading",
    label: "Paper Trading",
    status: "active",
    consumes: "entryRadar.tradeCandidates",
    outputKey: "paperPositions",
  },
  { id: "trading-log", label: "트레이딩 로그", status: "active", consumes: "paperTrading.closed" },
  { id: "returns-disclosure", label: "실제 수익 공개", status: "planned", consumes: "tradingLog.returns" },
]

/**
 * @param {number} raw
 */
function clampScore(raw) {
  return Math.max(35, Math.min(98, Math.round(raw)))
}

/**
 * @param {EntryGradeId} grade
 * @param {number} steps negative = stricter (toward D)
 */
function shiftGrade(grade, steps) {
  const order = ["A", "B", "C", "D"]
  const idx = Math.max(0, Math.min(3, order.indexOf(grade) + steps))
  return /** @type {EntryGradeId} */ (order[idx])
}

/**
 * @param {EntryGradeId} grade
 * @param {EntryGradeId} maxGrade best allowed (A best)
 */
function capGrade(grade, maxGrade) {
  return GRADE_ORDER[grade] < GRADE_ORDER[maxGrade] ? maxGrade : grade
}

/**
 * @param {{
 *   composite: number
 *   statusId: StockRadarStatusId
 *   stageId: string | null
 *   radarAlertId: string
 *   regimeId: string
 *   priA: number
 *   priB: number
 * }} input
 * @returns {EntryGradeId}
 */
function resolveEntryGrade(input) {
  let grade = /** @type {EntryGradeId} */ ("D")
  if (input.composite >= 82) grade = "A"
  else if (input.composite >= 72) grade = "B"
  else if (input.composite >= 58) grade = "C"

  if (input.radarAlertId === "critical") grade = capGrade(grade, "D")
  else if (input.radarAlertId === "danger") grade = capGrade(grade, "C")

  if (input.statusId === "watch") grade = capGrade(grade, "D")

  if (input.statusId === "strong") {
    grade = capGrade(grade, "C")
    if (input.stageId === "overheated") grade = capGrade(grade, "D")
  }

  if (input.statusId === "breakout") {
    if (input.stageId === "overheated") grade = capGrade(grade, "C")
    else if (input.stageId === "neutral") grade = capGrade(grade, "B")
    if (["dca", "panicBuy"].includes(input.stageId ?? "") && input.composite >= 78) {
      grade = shiftGrade(grade, -1)
    }
  }

  if (input.statusId === "dip") {
    if (["interest", "dca", "panicBuy"].includes(input.stageId ?? "")) {
      grade = shiftGrade(grade, -1)
    }
    if (input.stageId === "overheated") grade = capGrade(grade, "B")
  }

  if (input.stageId === "overheated" && grade === "A") grade = "B"

  if (input.priA >= 55 || input.priB >= 55) grade = capGrade(grade, "C")
  if (input.regimeId === "risk" && grade === "A") grade = "B"

  return grade
}

/**
 * @param {EntryGradeId} grade
 * @param {StockRadarStatusId} statusId
 * @param {string | null} stageId
 */
function resolveEntryAction(grade, statusId, stageId) {
  if (grade === "A" && statusId === "dip") {
    return stageId === "interest" || stageId === "dca" || stageId === "panicBuy"
      ? "관심구간"
      : ENTRY_GRADE_DEFAULT_ACTION.A
  }
  if (grade === "C" && (statusId === "strong" || statusId === "breakout")) {
    return "추격금지"
  }
  return ENTRY_GRADE_DEFAULT_ACTION[grade]
}

/**
 * @param {{
 *   dashboard: ReturnType<typeof buildPrecursorDashboardBetaReport>
 *   phase6: ReturnType<typeof buildPrecursorEnginePhase6Report>
 *   sectorRadar: ReturnType<typeof buildSectorRadarFromPrecursorContext>
 *   stockRadar: ReturnType<typeof buildStockRadarFromPrecursorContext>
 * }} ctx
 */
export function buildEntryRadarFromPrecursorContext(ctx) {
  const { dashboard, phase6, sectorRadar, stockRadar } = ctx
  const stageId = sectorRadar.exportForStockRadar?.stageId ?? null
  const regimeId = dashboard.cards.regime.regimeId ?? "unknown"
  const radarAlertId = phase6.radarAlert?.id ?? "normal"
  const priA = dashboard.cards.priA.value ?? 0
  const priB = dashboard.cards.priB.value ?? 0

  const marketFitBase = STAGE_MARKET_FIT[/** @type {string} */ (stageId)] ?? 70
  const riskPenalty =
    (RADAR_RISK_PENALTY[radarAlertId] ?? 8) + (REGIME_RISK_PENALTY[regimeId] ?? 6)
  const riskScore = clampScore(100 - riskPenalty - (priA >= 45 ? 6 : 0) - (priB >= 50 ? 6 : 0))

  const picks = (stockRadar.topBuys ?? []).map((pick) => {
    const statusId = /** @type {StockRadarStatusId} */ (pick.status?.id ?? "watch")
    const marketFit = clampScore(pick.scoreBreakdown?.marketFit ?? marketFitBase)
    const stockScore = clampScore(pick.score)
    const technicalStatus = clampScore(TECHNICAL_STATUS_SCORE[statusId] ?? 55)

    const composite = clampScore(
      marketFit * ENTRY_RADAR_SCORE_WEIGHTS.marketFit +
        stockScore * ENTRY_RADAR_SCORE_WEIGHTS.stockScore +
        technicalStatus * ENTRY_RADAR_SCORE_WEIGHTS.technicalStatus +
        riskScore * ENTRY_RADAR_SCORE_WEIGHTS.risk,
    )

    const grade = resolveEntryGrade({
      composite,
      statusId,
      stageId,
      radarAlertId,
      regimeId,
      priA,
      priB,
    })

    const action = resolveEntryAction(grade, statusId, stageId)
    const gradeMeta = ENTRY_GRADE_DEFINITIONS[grade]

    return {
      id: pick.id,
      name: pick.name,
      symbol: pick.symbol,
      code: pick.code,
      market: pick.market,
      marketLabel: pick.marketLabel,
      rank: pick.rank,
      score: pick.score,
      status: pick.status,
      grade: {
        id: grade,
        label: gradeMeta.label,
        summary: gradeMeta.summary,
        action,
        actionDisplay: `행동 · ${action}`,
      },
      entryScore: composite,
      scoreBreakdown: {
        marketFit,
        stockScore,
        technicalStatus,
        risk: riskScore,
        weights: ENTRY_RADAR_SCORE_WEIGHTS,
      },
      tradingStage: pick.tradingStage,
      sectorRadarId: pick.sectorRadarId,
    }
  })

  const gradeOrder = { A: 0, B: 1, C: 2, D: 3 }
  const tradeCandidates = [...picks].sort((a, b) => {
    const g = gradeOrder[a.grade.id] - gradeOrder[b.grade.id]
    if (g !== 0) return g
    return b.entryScore - a.entryScore
  })

  const byGrade = {
    A: tradeCandidates.filter((c) => c.grade.id === "A"),
    B: tradeCandidates.filter((c) => c.grade.id === "B"),
    C: tradeCandidates.filter((c) => c.grade.id === "C"),
    D: tradeCandidates.filter((c) => c.grade.id === "D"),
  }

  return {
    label: PRECURSOR_ENGINE_PHASE27_LABEL,
    title: "실전 매매 후보",
    available: stockRadar.available && tradeCandidates.length > 0,
    asOf: stockRadar.asOf ?? dashboard.asOf,
    scoreWeights: ENTRY_RADAR_SCORE_WEIGHTS,
    scoreWeightsDisplay: "시장 적합도 30% · 종목 점수 30% · 기술적 상태 30% · 리스크 10%",
    gradeDefinitions: ENTRY_GRADE_DEFINITIONS,
    tradeCandidates,
    byGrade,
    pipeline: ENTRY_RADAR_PIPELINE,
    inputs: {
      stageId,
      stageLabel: sectorRadar.currentMarket?.display ?? "—",
      ydsScore: stockRadar.inputs?.ydsScore,
      ydsDisplay: stockRadar.inputs?.ydsDisplay,
      priADisplay: stockRadar.inputs?.priADisplay,
      priBDisplay: stockRadar.inputs?.priBDisplay,
      regimeLabel: stockRadar.inputs?.regimeLabel,
      radarAlertLabel: stockRadar.inputs?.radarAlertLabel,
      sectorRadarIds: sectorRadar.exportForStockRadar?.sectorIds ?? [],
      stockRadarCount: stockRadar.topBuys?.length ?? 0,
    },
    exportForTradingLog: {
      version: 1,
      asOf: stockRadar.asOf ?? dashboard.asOf,
      stageId,
      candidates: tradeCandidates.map((c) => ({
        id: c.id,
        name: c.name,
        symbol: c.symbol,
        grade: c.grade.id,
        action: c.grade.action,
        entryScore: c.entryScore,
        stockScore: c.score,
        statusId: c.status.id,
      })),
    },
    notes: [
      "Stock Radar(Phase 26) + Sector Radar + YDS 단계 읽기 전용",
      "진입등급은 '좋은 종목'이 아닌 '지금 들어갈 종목' 판단용",
      "exportForTradingLog → 향후 트레이딩 로그·수익 공개 연결",
    ],
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 * @param {{ latestSnapshot?: Record<string, unknown> | null; extraRows?: object[] }} [options]
 */
export function buildPrecursorEnginePhase27Report(events, options = {}) {
  const engineOptions = {
    latestSnapshot: options.latestSnapshot ?? null,
    extraRows: options.extraRows ?? [],
    log: loadPrecursorValidationLog(),
  }
  const dashboard = buildPrecursorDashboardBetaReport(events, engineOptions)
  const phase6 = buildPrecursorEnginePhase6Report(events, engineOptions)
  const sectorRadar = buildSectorRadarFromPrecursorContext({
    dashboard,
    phase6,
    latestSnapshot: options.latestSnapshot ?? null,
  })
  const stockRadar = buildStockRadarFromPrecursorContext({ dashboard, phase6, sectorRadar })
  return buildEntryRadarFromPrecursorContext({ dashboard, phase6, sectorRadar, stockRadar })
}

export function formatEntryRadarScore(value) {
  if (value == null || !Number.isFinite(value)) return "—"
  return formatMetric(value, 0)
}
