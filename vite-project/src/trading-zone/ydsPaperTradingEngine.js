import { formatMetric } from "./ydsHistoricalEventTypes.js"
import { formatJournalPrice, formatJournalReturnPct } from "./ydsPrecursorEnginePhase28.js"
import {
  loadPaperTrading,
  refreshPaperTradingPrices,
  syncPaperTradesFromEntryRadar,
  setPaperTradingIncludeGradeB,
} from "./ydsPaperTradingStorage.js"

export const PAPER_TRADING_LABEL = "Auto Paper Trading — Phase 28.5"

export const PAPER_TRADE_GRADE_POLICY = {
  A: { auto: true, label: "자동 생성" },
  B: { auto: false, optional: true, label: "선택 생성" },
  C: { auto: false, label: "생성 안함" },
  D: { auto: false, label: "생성 안함" },
}

export const PAPER_TRADING_PIPELINE = [
  { id: "entry-radar", label: "Entry Radar", status: "active" },
  { id: "paper-trading", label: "Paper Trading", status: "active", outputKey: "positions" },
  { id: "trading-journal", label: "Trading Journal", status: "active", consumes: "paperTrading.closed" },
  {
    id: "portfolio-builder",
    label: "Portfolio Builder",
    status: "active",
    consumes: "convictionEngine.allocations",
  },
  {
    id: "performance-dashboard",
    label: "Performance Dashboard",
    status: "active",
    consumes: "paperTrading.positions",
  },
  { id: "live-account", label: "실전 계좌 공개", status: "planned" },
]

/**
 * @param {import("./ydsPaperTradingStorage.js").PaperPositionRow} row
 */
function enrichPaperRow(row) {
  return {
    ...row,
    returnDisplay: formatJournalReturnPct(row.returnPct),
    currentProfitDisplay: formatJournalReturnPct(row.currentProfitPct),
    maxProfitDisplay: formatJournalReturnPct(row.maxProfitPct),
    maxLossDisplay: formatJournalReturnPct(row.maxLossPct),
    entryPriceDisplay: formatJournalPrice(row.entryPrice, row.symbol, row.code),
    currentPriceDisplay: formatJournalPrice(
      row.status === "OPEN" ? row.currentPrice : (row.exitPrice ?? row.currentPrice),
      row.symbol,
      row.code,
    ),
    tone:
      row.currentProfitPct == null
        ? "neutral"
        : row.currentProfitPct > 0
          ? "up"
          : row.currentProfitPct < 0
            ? "down"
            : "neutral",
  }
}

/**
 * @param {ReturnType<typeof loadPaperTrading>} state
 */
export function buildPaperTradingReport(state) {
  const refreshed = refreshPaperTradingPrices(state)
  const open = refreshed.positions.filter((p) => p.status === "OPEN").map(enrichPaperRow)
  const closed = refreshed.positions.filter((p) => p.status === "CLOSED").map(enrichPaperRow)

  const closedReturns = closed.map((p) => p.returnPct).filter((v) => v != null)
  const openReturns = open.map((p) => p.currentProfitPct).filter((v) => v != null)
  const allReturns = [...closedReturns, ...openReturns]

  const wins = closedReturns.filter((r) => (r ?? 0) > 0).length
  const winRate =
    closedReturns.length > 0 ? Math.round((wins / closedReturns.length) * 1000) / 10 : null

  return {
    label: PAPER_TRADING_LABEL,
    title: "Paper Trading",
    available: refreshed.positions.length > 0,
    includeGradeB: refreshed.includeGradeB,
    gradePolicy: PAPER_TRADE_GRADE_POLICY,
    open,
    closed,
    counts: {
      open: open.length,
      closed: closed.length,
      total: refreshed.positions.length,
    },
    summary: {
      openCount: open.length,
      closedCount: closed.length,
      winRate,
      winRateDisplay: winRate != null ? `${formatMetric(winRate, 1)}%` : "—",
      avgOpenPnl:
        openReturns.length > 0
          ? Math.round((openReturns.reduce((a, b) => a + b, 0) / openReturns.length) * 10) / 10
          : null,
      avgOpenPnlDisplay: formatJournalReturnPct(
        openReturns.length > 0
          ? openReturns.reduce((a, b) => a + b, 0) / openReturns.length
          : null,
      ),
      bestOpen:
        openReturns.length > 0 ? Math.max(...openReturns.map((r) => r ?? -Infinity)) : null,
      worstOpen:
        openReturns.length > 0 ? Math.min(...openReturns.map((r) => r ?? Infinity)) : null,
    },
    pipeline: PAPER_TRADING_PIPELINE,
    exportForTradingJournal: {
      version: 1,
      openIds: open.map((p) => p.id),
      closedIds: closed.map((p) => p.id),
    },
    notes: [
      "실제 매매 아님 · 가상매매 실시간 추적",
      "A등급 자동 생성 · B등급은 '선택 생성' 토글 시에만",
      "YDS 엔진 미수정 · 독립 localStorage 모듈",
    ],
  }
}

/**
 * @param {ReturnType<typeof import("./ydsPrecursorEnginePhase27.js").buildEntryRadarFromPrecursorContext>} entryRadar
 * @param {{ includeGradeB?: boolean; sync?: boolean }} [options]
 */
export function buildPaperTradingFromEntryRadar(entryRadar, options = {}) {
  let state = loadPaperTrading()
  if (options.includeGradeB != null) {
    state = setPaperTradingIncludeGradeB(options.includeGradeB)
  }

  let syncResult = null
  if (options.sync !== false && entryRadar?.available) {
    syncResult = syncPaperTradesFromEntryRadar(entryRadar, {
      includeGradeB: state.includeGradeB,
    })
    state = syncResult.state
  } else {
    state = refreshPaperTradingPrices(state)
  }

  const report = buildPaperTradingReport(state)
  return {
    ...report,
    lastSync: syncResult
      ? { created: syncResult.created, skipped: syncResult.skipped }
      : null,
  }
}
