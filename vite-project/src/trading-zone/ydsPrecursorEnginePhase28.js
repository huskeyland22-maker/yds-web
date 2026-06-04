import { formatMetric } from "./ydsHistoricalEventTypes.js"
import { buildPrecursorDashboardBetaReport } from "./ydsPrecursorEnginePhase12.js"
import { buildPrecursorEnginePhase6Report } from "./ydsPrecursorEnginePhase6.js"
import { buildSectorRadarFromPrecursorContext } from "./ydsPrecursorEnginePhase25.js"
import { buildStockRadarFromPrecursorContext } from "./ydsPrecursorEnginePhase26.js"
import { buildEntryRadarFromPrecursorContext } from "./ydsPrecursorEnginePhase27.js"
import { loadPrecursorValidationLog } from "./ydsPrecursorValidationLogStorage.js"
import {
  buildSeedJournalTrades,
  computeReturnPct,
  journalStatusLabel,
  sortTradesRecentFirst,
} from "./ydsPrecursorTradingJournalStorage.js"

export const PRECURSOR_ENGINE_PHASE28_LABEL = "Trading Journal — Phase 28"

export const TRADING_JOURNAL_PIPELINE = [
  { id: "entry-radar", label: "Entry Radar", status: "active" },
  { id: "trading-journal", label: "Trading Journal", status: "active", outputKey: "trades" },
  {
    id: "performance-dashboard",
    label: "Performance Dashboard",
    status: "planned",
    consumes: "tradingJournal.stats",
  },
]

/**
 * @param {import("./ydsPrecursorTradingJournalStorage.js").JournalTradeRow[]} trades
 */
export function computeTradingJournalStats(trades) {
  const closed = trades.filter((t) => t.status !== "holding" && t.returnPct != null)
  const wins = closed.filter((t) => (t.returnPct ?? 0) > 0)
  const losses = closed.filter((t) => (t.returnPct ?? 0) < 0)
  const winReturns = wins.map((t) => t.returnPct ?? 0)
  const lossReturns = losses.map((t) => t.returnPct ?? 0)

  const avgWin =
    winReturns.length > 0
      ? Math.round((winReturns.reduce((a, b) => a + b, 0) / winReturns.length) * 10) / 10
      : null
  const avgLoss =
    lossReturns.length > 0
      ? Math.round((lossReturns.reduce((a, b) => a + b, 0) / lossReturns.length) * 10) / 10
      : null

  const profitFactor =
    avgWin != null && avgLoss != null && avgLoss !== 0
      ? Math.round((avgWin / Math.abs(avgLoss)) * 100) / 100
      : null

  const allReturns = closed.map((t) => t.returnPct ?? 0)
  const maxProfit = allReturns.length ? Math.max(...allReturns) : null
  const maxLoss = allReturns.length ? Math.min(...allReturns) : null

  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    openTrades: trades.filter((t) => t.status === "holding").length,
    winRate:
      closed.length > 0 ? Math.round((wins.length / closed.length) * 1000) / 10 : null,
    avgProfitPct: avgWin,
    avgLossPct: avgLoss,
    profitFactor,
    maxProfitPct: maxProfit,
    maxLossPct: maxLoss,
  }
}

/**
 * @param {number | null | undefined} value
 * @param {'kr' | 'us' | undefined} marketHint
 */
/**
 * @param {string | null | undefined} symbol
 * @param {string | null | undefined} code
 */
function isUsListedSymbol(symbol, code) {
  const key = String(code ?? symbol ?? "")
  if (/^\d{6}$/.test(key)) return false
  return /^[A-Z.\-]{1,8}$/i.test(key)
}

/**
 * @param {number | null | undefined} value
 * @param {string | null | undefined} symbol
 * @param {string | null | undefined} code
 */
export function formatJournalPrice(value, symbol, code) {
  if (value == null || !Number.isFinite(value)) return "—"
  const n = value
  if (isUsListedSymbol(symbol, code)) {
    const digits = n >= 100 ? 0 : 2
    return `$${n.toLocaleString("en-US", { maximumFractionDigits: digits })}`
  }
  return Math.round(n).toLocaleString("ko-KR")
}

export function formatJournalReturnPct(value) {
  if (value == null || !Number.isFinite(value)) return "—"
  const sign = value > 0 ? "+" : ""
  return `${sign}${formatMetric(value, 1)}%`
}

/**
 * @param {import("./ydsPrecursorTradingJournalStorage.js").JournalTradeRow} row
 */
function enrichTradeRow(row) {
  const entry = row.entryPrice
  const mark = row.status === "holding" ? row.currentPrice : row.exitPrice
  const returnPct =
    row.returnPct != null
      ? row.returnPct
      : computeReturnPct(entry, mark ?? null)

  return {
    ...row,
    statusLabel: row.statusLabel ?? journalStatusLabel(row.status),
    returnPct,
    returnDisplay: formatJournalReturnPct(returnPct),
    entryPriceDisplay: formatJournalPrice(entry, row.symbol, row.code),
    currentPriceDisplay:
      row.status === "holding"
        ? formatJournalPrice(row.currentPrice, row.symbol, row.code)
        : formatJournalPrice(row.exitPrice, row.symbol, row.code),
    tone: returnPct == null ? "neutral" : returnPct > 0 ? "up" : returnPct < 0 ? "down" : "neutral",
  }
}

/**
 * @param {{
 *   trades: import("./ydsPrecursorTradingJournalStorage.js").JournalTradeRow[]
 *   entryRadar?: ReturnType<typeof buildEntryRadarFromPrecursorContext> | null
 *   asOf?: string | null
 * }} input
 */
export function buildTradingJournalFromTrades(input) {
  const sorted = sortTradesRecentFirst(input.trades ?? [])
  const recent = sorted.slice(0, 20).map(enrichTradeRow)
  const stats = computeTradingJournalStats(sorted)

  return {
    label: PRECURSOR_ENGINE_PHASE28_LABEL,
    title: "트레이드 로그",
    available: recent.length > 0,
    asOf: input.asOf ?? null,
    recentTrades: recent,
    stats: {
      ...stats,
      winRateDisplay: stats.winRate != null ? `${formatMetric(stats.winRate, 1)}%` : "—",
      avgProfitDisplay: formatJournalReturnPct(stats.avgProfitPct),
      avgLossDisplay: formatJournalReturnPct(stats.avgLossPct),
      profitFactorDisplay:
        stats.profitFactor != null ? formatMetric(stats.profitFactor, 2) : "—",
      maxProfitDisplay: formatJournalReturnPct(stats.maxProfitPct),
      maxLossDisplay: formatJournalReturnPct(stats.maxLossPct),
    },
    pipeline: TRADING_JOURNAL_PIPELINE,
    entryRadarLinked: Boolean(input.entryRadar?.available),
    exportForPerformanceDashboard: {
      version: 1,
      asOf: input.asOf,
      stats,
      tradeIds: sorted.map((t) => t.id),
    },
    notes: [
      "Entry Radar 추천 종목의 실제 진입·청산 기록 (localStorage)",
      "최근 20건 표시 · YDS 엔진 미수정",
      "exportForPerformanceDashboard → Phase 29 Performance Dashboard 예정",
    ],
  }
}

/**
 * @param {{
 *   trades?: import("./ydsPrecursorTradingJournalStorage.js").JournalTradeRow[]
 *   entryRadar: ReturnType<typeof buildEntryRadarFromPrecursorContext>
 *   asOf?: string | null
 * }} ctx
 */
export function buildTradingJournalFromPrecursorContext(ctx) {
  const trades =
    ctx.trades?.length ? ctx.trades : buildSeedJournalTrades()
  return buildTradingJournalFromTrades({
    trades,
    entryRadar: ctx.entryRadar,
    asOf: ctx.asOf ?? ctx.entryRadar?.asOf ?? null,
  })
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 * @param {{
 *   latestSnapshot?: Record<string, unknown> | null
 *   extraRows?: object[]
 *   trades?: import("./ydsPrecursorTradingJournalStorage.js").JournalTradeRow[]
 * }} [options]
 */
export function buildPrecursorEnginePhase28Report(events, options = {}) {
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
  const entryRadar = buildEntryRadarFromPrecursorContext({
    dashboard,
    phase6,
    sectorRadar,
    stockRadar,
  })
  return buildTradingJournalFromPrecursorContext({
    trades: options.trades,
    entryRadar,
    asOf: dashboard.asOf,
  })
}
