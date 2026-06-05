import { formatStockRadarScore } from "./ydsPrecursorEnginePhase26.js"
import { resolvePortfolioStageMeta } from "./ydsPrecursorEnginePhase23.js"
import { SECTOR_RADAR_CATALOG } from "./ydsPrecursorEnginePhase25.js"
import { YDS_VALIDATION_EVENT_DATASET } from "./ydsHistoricalValidationEvents.js"
import { buildCurrentMarketAnalysisReport } from "./ydsCurrentMarketAnalysis.js"
import { getTradingZonePositions } from "./tacticalTradingZoneData.js"
import { loadPaperTrading, refreshPaperTradingPrices } from "./ydsPaperTradingStorage.js"
import { loadPrecursorValidationLog } from "./ydsPrecursorValidationLogStorage.js"
import { buildWatchlistItemExplain } from "./ydsWatchlistExplain.js"

export const WATCHLIST_CENTER_LABEL = "관심종목 · YDS V1"

/** @typedef {'observe' | 'dip_wait' | 'entry_ready' | 'holding' | 'take_profit_wait'} WatchStateId */
/** @typedef {'today' | 'week' | 'long_term'} WatchPriorityId */

export const WATCH_STATES = [
  { id: "observe", label: "관찰", tone: "neutral" },
  { id: "dip_wait", label: "눌림대기", tone: "dip" },
  { id: "entry_ready", label: "진입가능", tone: "ready" },
  { id: "holding", label: "보유", tone: "hold" },
  { id: "take_profit_wait", label: "익절대기", tone: "tp" },
]

export const WATCH_PRIORITIES = [
  { id: "today", label: "오늘 즉시 확인" },
  { id: "week", label: "이번주 관찰" },
  { id: "long_term", label: "장기 관심" },
]

const STAGE_ORDER = ["overheated", "neutral", "interest", "dca", "panicBuy"]

/** @type {Record<string, string>} */
const SECTOR_LABEL_BY_ID = Object.fromEntries(SECTOR_RADAR_CATALOG.map((s) => [s.id, s.label]))

/** @type {Record<string, { entry: number; dip: number; observe: number; label: string }>} */
const STAGE_INTENSITY = {
  overheated: { entry: 0.55, dip: 0.65, observe: 1, label: "과열 — 진입 강도 축소" },
  neutral: { entry: 0.85, dip: 0.88, observe: 1, label: "중립 — 선별 관찰" },
  interest: { entry: 1, dip: 0.95, observe: 0.92, label: "관심 — 눌림·관찰 병행" },
  dca: { entry: 1.12, dip: 1.08, observe: 0.82, label: "분할매수 — 진입 적극" },
  panicBuy: { entry: 1.2, dip: 1.15, observe: 0.75, label: "패닉매수 — 핵심 종목 우선" },
}

/**
 * @param {ReturnType<typeof getTradingZonePositions>[number] | null | undefined} tzPos
 */
function buildTradePlan(tzPos, stockStatusId) {
  if (tzPos?.entry) {
    const t1 = tzPos.target ?? "—"
    const t2 =
      tzPos.targetNum != null && Number.isFinite(tzPos.targetNum)
        ? String(Math.round(tzPos.targetNum * 1.12))
        : "—"
    return {
      buyZone: tzPos.entry,
      stopLoss: tzPos.stop ?? "—",
      target1: t1,
      target2: t2 !== "—" ? `${t2} (2차)` : "—",
    }
  }
  if (stockStatusId === "dip") {
    return {
      buyZone: "눌림 구간 대기",
      stopLoss: "전저점 -5%",
      target1: "+8~12%",
      target2: "+15~20%",
    }
  }
  if (stockStatusId === "breakout") {
    return {
      buyZone: "돌파 확인 후",
      stopLoss: "돌파봉 저점",
      target1: "+6~10%",
      target2: "+12~18%",
    }
  }
  return {
    buyZone: "관심 구간",
    stopLoss: "—",
    target1: "—",
    target2: "—",
  }
}

/**
 * @param {{
 *   stock: import("./ydsPrecursorEnginePhase26.js").buildStockRadarFromPrecursorContext extends (...args: any) => infer R ? R extends { topBuys: (infer P)[] } ? P : never : never
 *   entry?: { grade: { id: string } } | null
 *   paper?: import("./ydsPaperTradingStorage.js").PaperPositionRow | null
 *   tzPos?: ReturnType<typeof getTradingZonePositions>[number] | null
 * }} input
 * @returns {WatchStateId}
 */
function resolveWatchState(input) {
  const { stock, entry, paper, tzPos } = input
  if (paper?.status === "OPEN") {
    const pnl = paper.currentProfitPct ?? paper.returnPct ?? 0
    if (pnl >= 8 || tzPos?.stage === "takeProfit") return "take_profit_wait"
    return "holding"
  }
  const grade = entry?.grade?.id
  if (grade === "A" && (stock.status.id === "dip" || stock.status.id === "breakout")) {
    return "entry_ready"
  }
  if (grade === "B" && stock.status.id === "dip") return "entry_ready"
  if (stock.status.id === "dip") return "dip_wait"
  return "observe"
}

/**
 * @param {WatchStateId} stateId
 * @param {number} score
 * @param {string | null} stageId
 */
function resolvePriority(stateId, score, stageId) {
  const intensity = STAGE_INTENSITY[/** @type {string} */ (stageId)] ?? STAGE_INTENSITY.neutral
  const mul =
    stateId === "entry_ready"
      ? intensity.entry
      : stateId === "dip_wait"
        ? intensity.dip
        : intensity.observe
  const effective = score * mul
  if (stateId === "entry_ready" && effective >= 78) return "today"
  if (stateId === "holding" || stateId === "take_profit_wait") return "today"
  if (effective >= 72 || stateId === "dip_wait") return "week"
  return "long_term"
}

/**
 * @param {ReturnType<typeof buildCurrentMarketAnalysisReport>} market
 */
export function buildWatchlistCenterFromMarketAnalysis(market) {
  const stageId = market.sectorRadar?.exportForStockRadar?.stageId ?? "neutral"
  const stagePortfolioMeta = resolvePortfolioStageMeta(stageId)
  const stageMeta = STAGE_INTENSITY[/** @type {string} */ (stageId)] ?? STAGE_INTENSITY.neutral

  const paperState = refreshPaperTradingPrices(loadPaperTrading())
  /** @type {Map<string, import("./ydsPaperTradingStorage.js").PaperPositionRow>} */
  const paperById = new Map()
  for (const p of paperState.positions) {
    paperById.set(p.id, p)
    paperById.set(p.candidateId, p)
  }

  /** @type {Map<string, ReturnType<typeof buildCurrentMarketAnalysisReport>["entryRadar"]["tradeCandidates"][number]>} */
  const entryById = new Map()
  for (const c of market.entryRadar?.tradeCandidates ?? []) {
    entryById.set(c.id, c)
  }

  const tzPositions = getTradingZonePositions()
  /** @type {Map<string, (typeof tzPositions)[number]>} */
  const tzById = new Map(tzPositions.map((p) => [p.id, p]))

  const top10 = (market.stockRadar?.topBuys ?? []).slice(0, 10)

  const items = top10.map((stock) => {
    const entry = entryById.get(stock.id) ?? null
    const paper = paperById.get(stock.id) ?? null
    const tzPos = tzById.get(stock.id) ?? null
    const watchStateId = resolveWatchState({ stock, entry, paper, tzPos })
    const watchState = WATCH_STATES.find((s) => s.id === watchStateId) ?? WATCH_STATES[0]
    const priorityId = resolvePriority(watchStateId, stock.score, stageId)
    const priority = WATCH_PRIORITIES.find((p) => p.id === priorityId) ?? WATCH_PRIORITIES[1]
    const intensityMul =
      watchStateId === "entry_ready"
        ? stageMeta.entry
        : watchStateId === "dip_wait"
          ? stageMeta.dip
          : stageMeta.observe
    const adjustedScore = Math.round(stock.score * intensityMul * 10) / 10
    const explain = buildWatchlistItemExplain({
      watchStateId,
      watchStateLabel: watchState.label,
      priorityId,
      sectorLabel: SECTOR_LABEL_BY_ID[stock.sectorRadarId] ?? stock.sectorRadarId,
      score: stock.score,
      stockStatus: stock.status,
      scoreBreakdown: stock.scoreBreakdown
        ? {
            marketFit: stock.scoreBreakdown.marketFit,
            sectorStrength: stock.scoreBreakdown.sectorStrength,
            technicalTrend: stock.scoreBreakdown.technicalTrend,
          }
        : null,
    })

    return {
      id: stock.id,
      rank: stock.rank,
      name: stock.name,
      symbol: stock.symbol,
      market: stock.market,
      score: stock.score,
      scoreDisplay: formatStockRadarScore(stock.score),
      adjustedScore,
      adjustedScoreDisplay: formatStockRadarScore(adjustedScore),
      sectorLabel: SECTOR_LABEL_BY_ID[stock.sectorRadarId] ?? stock.sectorRadarId,
      stockStatus: stock.status,
      entryGrade: entry?.grade?.id ?? "—",
      watchStateId,
      watchStateLabel: watchState.label,
      watchStateTone: watchState.tone,
      priorityId,
      priorityLabel: priority.label,
      tradePlan: buildTradePlan(tzPos, stock.status.id),
      paperLinked: Boolean(paper),
      explain,
    }
  })

  const byState = Object.fromEntries(
    WATCH_STATES.map((s) => [s.id, items.filter((i) => i.watchStateId === s.id).length]),
  )

  const byPriority = {
    today: items.filter((i) => i.priorityId === "today"),
    week: items.filter((i) => i.priorityId === "week"),
    long_term: items.filter((i) => i.priorityId === "long_term"),
  }

  return {
    label: WATCHLIST_CENTER_LABEL,
    title: "관심종목",
    available: items.length > 0,
    asOf: market.asOf,
    stage: {
      id: stageId,
      emoji: stagePortfolioMeta?.emoji ?? "⚪",
      shortLabel: stagePortfolioMeta?.shortLabel ?? stageId,
      display:
        stagePortfolioMeta != null
          ? `${stagePortfolioMeta.emoji} ${stagePortfolioMeta.shortLabel}`
          : (market.sectorRadar?.currentMarket?.display ?? stageId),
      intensityLabel: stageMeta.label,
      guidance:
        stageId === "overheated"
          ? "신규 진입보다 관찰·익절 관리 우선"
          : stageId === "panicBuy"
            ? "핵심 종목 분할 진입 검토"
            : "우선순위에 따라 단계적 대응",
    },
    sectionA: { items },
    sectionB: { states: WATCH_STATES, counts: byState },
    sectionE: { priorities: WATCH_PRIORITIES, groups: byPriority },
    sectionF: {
      current: {
        id: stageId,
        display:
          stagePortfolioMeta != null
            ? `${stagePortfolioMeta.emoji} ${stagePortfolioMeta.shortLabel}`
            : stageId,
        intensityLabel: stageMeta.label,
        guidance:
          stageId === "overheated"
            ? "신규 진입보다 관찰·익절 관리 우선"
            : stageId === "panicBuy"
              ? "핵심 종목 분할 진입 검토"
              : "우선순위에 따라 단계적 대응",
      },
      bands: STAGE_ORDER.map((id) => {
        const meta = resolvePortfolioStageMeta(id)
        const intensity = STAGE_INTENSITY[id]
        return {
          id,
          emoji: meta?.emoji ?? "⚪",
          shortLabel: meta?.shortLabel ?? id,
          label: intensity.label,
          entryMul: intensity.entry,
          dipMul: intensity.dip,
          observeMul: intensity.observe,
          active: stageId === id,
        }
      }),
    },
    notes: [
      "종목 추천 Top10 + 진입 신호 + Paper Trading + 트레이딩존 가격대",
      "YDS 엔진 미수정 · 매매 계획은 시드 가격대 기준",
      "실제 매매 전 본인 확인 필수",
    ],
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} [events]
 * @param {{ latestSnapshot?: Record<string, unknown> | null; extraRows?: object[] }} [options]
 */
export function buildWatchlistCenterReport(events = YDS_VALIDATION_EVENT_DATASET, options = {}) {
  const market = buildCurrentMarketAnalysisReport(events, {
    latestSnapshot: options.latestSnapshot ?? null,
    extraRows: options.extraRows ?? [],
    log: loadPrecursorValidationLog(),
  })
  return buildWatchlistCenterFromMarketAnalysis(market)
}
