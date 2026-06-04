import { resolvePortfolioStageMeta } from "./ydsPrecursorEnginePhase23.js"
import { YDS_VALIDATION_EVENT_DATASET } from "./ydsHistoricalValidationEvents.js"
import { buildCurrentMarketAnalysisReport } from "./ydsCurrentMarketAnalysis.js"
import { buildWatchlistCenterFromMarketAnalysis } from "./ydsWatchlistCenterEngine.js"
import { loadPrecursorValidationLog } from "./ydsPrecursorValidationLogStorage.js"
import {
  appendAlertHistory,
  loadAlertHistory,
  loadAlertCenterSnapshot,
  saveAlertCenterSnapshot,
  ALERT_HISTORY_MAX,
} from "./ydsAlertCenterStorage.js"

export const ALERT_CENTER_LABEL = "Alert Center — Phase 36"

/** @typedef {'S' | 'A' | 'B' | 'C'} AlertGradeId */

export const ALERT_GRADES = [
  { id: "S", label: "S급", desc: "패닉지수 단계 변경" },
  { id: "A", label: "A급", desc: "진입가능 종목 발생" },
  { id: "B", label: "B급", desc: "섹터 순위 변화" },
  { id: "C", label: "C급", desc: "일반 관찰" },
]

export const STOCK_ALERT_TYPES = [
  { id: "entry_ready", label: "진입가능" },
  { id: "dip", label: "눌림목" },
  { id: "breakout", label: "돌파" },
  { id: "take_profit_wait", label: "익절대기" },
]

/** @type {Record<string, string>} */
const MARKET_STAGE_ENTRY_LABEL = {
  overheated: "과열 진입",
  neutral: "중립 진입",
  interest: "관심 진입",
  dca: "분할매수 진입",
  panicBuy: "패닉매수 진입",
}

function alertId(parts) {
  return `al-${parts.join("-")}`
}

function nowIso() {
  return new Date().toISOString()
}

/**
 * @param {ReturnType<typeof buildCurrentMarketAnalysisReport>} market
 * @param {ReturnType<typeof buildWatchlistCenterFromMarketAnalysis>} watchlist
 * @returns {import("./ydsAlertCenterStorage.js").AlertCenterSnapshot}
 */
export function buildAlertCenterSnapshot(market, watchlist) {
  const topSectors = market.sectorRadar?.topSectors ?? []
  return {
    asOf: market.asOf ?? null,
    stageId: market.sectorRadar?.exportForStockRadar?.stageId ?? null,
    sectorRanks: topSectors.slice(0, 8).map((s) => ({ id: s.id, rank: s.rank })),
    stocks: watchlist.sectionA.items.map((i) => ({
      id: i.id,
      watchStateId: i.watchStateId,
      statusId: i.stockStatus?.id ?? "watch",
    })),
  }
}

/**
 * @param {ReturnType<typeof buildWatchlistCenterFromMarketAnalysis>["sectionA"]["items"][number]} item
 * @returns {string | null}
 */
function resolveStockAlertSubtype(item) {
  if (item.watchStateId === "entry_ready") return "entry_ready"
  if (item.watchStateId === "take_profit_wait") return "take_profit_wait"
  if (item.watchStateId === "dip_wait" || item.stockStatus?.id === "dip") return "dip"
  if (item.stockStatus?.id === "breakout") return "breakout"
  return null
}

/**
 * @param {import("./ydsAlertCenterStorage.js").AlertCenterSnapshot | null} prev
 * @param {import("./ydsAlertCenterStorage.js").AlertCenterSnapshot} next
 * @param {ReturnType<typeof buildCurrentMarketAnalysisReport>} market
 * @param {ReturnType<typeof buildWatchlistCenterFromMarketAnalysis>} watchlist
 * @returns {import("./ydsAlertCenterStorage.js").AlertRow[]}
 */
function diffSnapshotToAlerts(prev, next, market, watchlist) {
  /** @type {import("./ydsAlertCenterStorage.js").AlertRow[]} */
  const out = []
  const at = nowIso()

  if (!prev) {
    for (const item of watchlist.sectionA.items.slice(0, 3)) {
      if (item.watchStateId !== "observe") continue
      out.push({
        id: alertId(["C", "boot", item.id]),
        grade: "C",
        category: "realtime",
        subtype: "observe",
        title: "일반 관찰",
        body: `${item.name} (${item.symbol}) · ${item.sectorLabel} · Top ${item.rank}`,
        at,
        symbol: item.symbol,
        stockName: item.name,
      })
    }
    return out
  }

  if (prev.stageId && next.stageId && prev.stageId !== next.stageId) {
    const fromMeta = resolvePortfolioStageMeta(prev.stageId)
    const toMeta = resolvePortfolioStageMeta(next.stageId)
    out.push({
      id: alertId(["S", "stage", next.stageId, at.slice(0, 16)]),
      grade: "S",
      category: "realtime",
      subtype: "stage_change",
      title: "패닉지수 단계 변경",
      body: `${fromMeta?.emoji ?? ""} ${fromMeta?.shortLabel ?? prev.stageId} → ${toMeta?.emoji ?? ""} ${toMeta?.shortLabel ?? next.stageId}`,
      at,
    })
    if (next.stageId && MARKET_STAGE_ENTRY_LABEL[next.stageId]) {
      out.push({
        id: alertId(["market", next.stageId, at.slice(0, 16)]),
        grade: "C",
        category: "market",
        subtype: next.stageId,
        title: MARKET_STAGE_ENTRY_LABEL[next.stageId],
        body: market.sectorRadar?.stagePolicy?.display ?? toMeta?.label ?? next.stageId,
        at,
      })
    }
  }

  const prevSector = new Map((prev?.sectorRanks ?? []).map((s) => [s.id, s.rank]))
  const nextTop3 = next.sectorRanks.slice(0, 3)
  const prevTop3 = (prev?.sectorRanks ?? []).slice(0, 3)
  if (prev?.sectorRanks?.length) {
    for (const s of next.sectorRanks) {
      const oldRank = prevSector.get(s.id)
      if (oldRank != null && Math.abs(oldRank - s.rank) >= 2) {
        const label =
          market.sectorRadar?.topSectors?.find((x) => x.id === s.id)?.label ?? s.id
        out.push({
          id: alertId(["B", "sector", s.id, String(s.rank), at.slice(0, 16)]),
          grade: "B",
          category: "realtime",
          subtype: "sector_rank",
          title: "섹터 순위 변화",
          body: `${label} · ${oldRank}위 → ${s.rank}위`,
          at,
        })
      }
    }
    if (prevTop3[0]?.id && nextTop3[0]?.id && prevTop3[0].id !== nextTop3[0].id) {
      const label =
        market.sectorRadar?.topSectors?.find((x) => x.id === nextTop3[0].id)?.label ??
        nextTop3[0].id
      out.push({
        id: alertId(["B", "top1", nextTop3[0].id, at.slice(0, 16)]),
        grade: "B",
        category: "realtime",
        subtype: "sector_top1",
        title: "1위 섹터 교체",
        body: `${label} 섹터가 1위로 상승`,
        at,
      })
    }
  }

  const prevStock = new Map((prev?.stocks ?? []).map((s) => [s.id, s]))
  for (const item of watchlist.sectionA.items) {
    const prevRow = prevStock.get(item.id)
    const stockSubtype = resolveStockAlertSubtype(item)
    const changed =
      !prevRow ||
      prevRow.watchStateId !== item.watchStateId ||
      prevRow.statusId !== (item.stockStatus?.id ?? "watch")

    if (!changed || !stockSubtype) continue

    if (stockSubtype === "entry_ready") {
      out.push({
        id: alertId(["A", item.id, at.slice(0, 16)]),
        grade: "A",
        category: "realtime",
        subtype: "entry_ready",
        title: "진입가능 종목 발생",
        body: `${item.name} (${item.symbol}) · Entry ${item.entryGrade} · ${item.sectorLabel}`,
        at,
        symbol: item.symbol,
        stockName: item.name,
      })
      continue
    }

    const typeMeta = STOCK_ALERT_TYPES.find((t) => t.id === stockSubtype)
    out.push({
      id: alertId(["stock", stockSubtype, item.id, at.slice(0, 16)]),
      grade: "C",
      category: "stock",
      subtype: stockSubtype,
      title: typeMeta?.label ?? stockSubtype,
      body: `${item.name} · ${item.watchStateLabel} · 점수 ${item.adjustedScoreDisplay}`,
      at,
      symbol: item.symbol,
      stockName: item.name,
    })
  }

  return out
}

/**
 * @param {ReturnType<typeof buildCurrentMarketAnalysisReport>} market
 * @returns {import("./ydsAlertCenterStorage.js").AlertRow[]}
 */
export function syncAlertCenterFromMarketAnalysis(market) {
  if (typeof window === "undefined") return []
  const watchlist = buildWatchlistCenterFromMarketAnalysis(market)
  const prev = loadAlertCenterSnapshot()
  const next = buildAlertCenterSnapshot(market, watchlist)
  const newAlerts = diffSnapshotToAlerts(prev, next, market, watchlist)
  if (newAlerts.length) appendAlertHistory(newAlerts)
  saveAlertCenterSnapshot(next)
  return newAlerts
}

/**
 * @param {import("./ydsAlertCenterStorage.js").AlertRow[]} history
 * @param {AlertGradeId | null} gradeFilter
 */
function filterByGrade(history, gradeFilter) {
  if (!gradeFilter) return history
  return history.filter((a) => a.grade === gradeFilter)
}

/**
 * @param {ReturnType<typeof buildCurrentMarketAnalysisReport>} market
 * @param {{ synced?: boolean }} [options]
 */
export function buildAlertCenterFromMarketAnalysis(market, options = {}) {
  if (options.synced !== false && typeof window !== "undefined") {
    syncAlertCenterFromMarketAnalysis(market)
  }

  const watchlist = buildWatchlistCenterFromMarketAnalysis(market)
  const history = loadAlertHistory()
  const stageId = market.sectorRadar?.exportForStockRadar?.stageId ?? null
  const stageMeta = resolvePortfolioStageMeta(stageId)

  const stockAlerts = {
    entry_ready: [],
    dip: [],
    breakout: [],
    take_profit_wait: [],
  }
  for (const item of watchlist.sectionA.items) {
    const sub = resolveStockAlertSubtype(item)
    if (sub && stockAlerts[/** @type {keyof typeof stockAlerts} */ (sub)]) {
      stockAlerts[/** @type {keyof typeof stockAlerts} */ (sub)].push({
        id: item.id,
        name: item.name,
        symbol: item.symbol,
        sectorLabel: item.sectorLabel,
        scoreDisplay: item.adjustedScoreDisplay,
        watchStateLabel: item.watchStateLabel,
      })
    }
  }

  const marketAlerts = Object.entries(MARKET_STAGE_ENTRY_LABEL).map(([id, label]) => ({
    id,
    label,
    active: stageId === id,
    display: resolvePortfolioStageMeta(id)?.shortLabel ?? id,
    emoji: resolvePortfolioStageMeta(id)?.emoji ?? "⚪",
  }))

  const sortedHistory = [...history].sort((a, b) => (a.at < b.at ? 1 : -1))

  return {
    label: ALERT_CENTER_LABEL,
    title: "Alert Center",
    available: Boolean(market.stockRadar?.available ?? market.sectorRadar?.available),
    asOf: market.asOf,
    stage: {
      id: stageId,
      display: stageMeta ? `${stageMeta.emoji} ${stageMeta.shortLabel}` : "—",
    },
    historyCount: history.length,
    historyMax: ALERT_HISTORY_MAX,
    sectionA: {
      items: sortedHistory,
      counts: {
        S: history.filter((a) => a.grade === "S").length,
        A: history.filter((a) => a.grade === "A").length,
        B: history.filter((a) => a.grade === "B").length,
        C: history.filter((a) => a.grade === "C").length,
      },
    },
    sectionB: {
      types: STOCK_ALERT_TYPES,
      groups: stockAlerts,
    },
    sectionC: {
      currentStageId: stageId,
      items: marketAlerts,
    },
    sectionD: {
      items: sortedHistory.slice(0, ALERT_HISTORY_MAX),
    },
    sectionE: {
      grades: ALERT_GRADES,
    },
    notes: [
      "Market Analysis · Sector/Stock Radar · Watchlist 스냅샷 diff",
      "히스토리 최근 100건 · localStorage",
      "YDS 엔진 미수정",
    ],
  }
}

/**
 * @param {import("./ydsAlertCenterStorage.js").AlertRow[]} history
 * @param {AlertGradeId | null} gradeFilter
 */
export function filterAlertHistory(history, gradeFilter) {
  return filterByGrade(history, gradeFilter)
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} [events]
 * @param {{ latestSnapshot?: Record<string, unknown> | null; extraRows?: object[]; sync?: boolean }} [options]
 */
export function buildAlertCenterReport(events = YDS_VALIDATION_EVENT_DATASET, options = {}) {
  const market = buildCurrentMarketAnalysisReport(events, {
    latestSnapshot: options.latestSnapshot ?? null,
    extraRows: options.extraRows ?? [],
    log: loadPrecursorValidationLog(),
  })
  const report = buildAlertCenterFromMarketAnalysis(market, {
    synced: options.sync !== false,
  })
  return report
}
