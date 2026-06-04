import { formatMetric } from "./ydsHistoricalEventTypes.js"
import { formatJournalReturnPct } from "./ydsPrecursorEnginePhase28.js"
import {
  loadPaperTrading,
  refreshPaperTradingPrices,
  inferPaperPositionSectorKey,
} from "./ydsPaperTradingStorage.js"

export const PERFORMANCE_DASHBOARD_LABEL = "Performance Dashboard — Phase 29"

/** @typedef {'30d' | '90d' | 'ytd' | 'all'} PerformancePeriodFilter */

export const PERFORMANCE_PERIOD_FILTERS = [
  { id: "30d", label: "30일" },
  { id: "90d", label: "90일" },
  { id: "ytd", label: "YTD" },
  { id: "all", label: "전체" },
]

export const PERFORMANCE_SECTORS = [
  { id: "semi", label: "반도체" },
  { id: "ai", label: "AI" },
  { id: "power", label: "전력" },
  { id: "defense", label: "방산" },
  { id: "robot", label: "로봇" },
  { id: "cosmetics", label: "화장품" },
]

export const PERFORMANCE_GRADES = ["A", "B", "C", "D"]

export const PERFORMANCE_DASHBOARD_PIPELINE = [
  { id: "paper-trading", label: "Paper Trading", status: "active" },
  { id: "performance-dashboard", label: "Performance Dashboard", status: "active" },
]

/**
 * @param {PerformancePeriodFilter} filter
 * @param {string} [refDate]
 */
export function periodStartDate(filter, refDate = new Date().toISOString().slice(0, 10)) {
  if (filter === "all") return null
  const d = new Date(refDate)
  if (filter === "ytd") return `${d.getFullYear()}-01-01`
  if (filter === "90d") {
    d.setDate(d.getDate() - 90)
    return d.toISOString().slice(0, 10)
  }
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

/**
 * @param {import("./ydsPaperTradingStorage.js").PaperPositionRow} row
 * @param {string | null} start
 */
function rowInPeriod(row, start) {
  if (!start) return true
  const anchor = row.closedAt ?? row.createdAt ?? row.entryDate
  return anchor >= start
}

/**
 * @param {import("./ydsPaperTradingStorage.js").PaperPositionRow} row
 */
function tradeReturnPct(row) {
  if (row.status === "CLOSED") return row.returnPct
  return row.currentProfitPct ?? row.returnPct
}

/**
 * @param {number[]} curve
 */
function computeMddPct(curve) {
  if (!curve.length) return null
  let peak = curve[0]
  let mdd = 0
  for (const v of curve) {
    peak = Math.max(peak, v)
    mdd = Math.min(mdd, v - peak)
  }
  return Math.round(Math.abs(mdd) * 10) / 10
}

/**
 * @param {ReturnType<typeof loadPaperTrading>["positions"]} positions
 * @param {PerformancePeriodFilter} period
 */
export function buildPerformanceDashboardReport(positions, period = "all") {
  const start = periodStartDate(period)
  const filtered = positions.filter((row) => rowInPeriod(row, start))
  const closed = filtered.filter((t) => t.status === "CLOSED")
  const open = filtered.filter((t) => t.status === "OPEN")

  const closedReturns = closed
    .map((t) => tradeReturnPct(t))
    .filter((v) => v != null && Number.isFinite(v))
  const wins = closedReturns.filter((r) => r > 0)
  const losses = closedReturns.filter((r) => r < 0)

  const avgProfit =
    closedReturns.length > 0
      ? Math.round((closedReturns.reduce((a, b) => a + b, 0) / closedReturns.length) * 10) / 10
      : null
  const avgWin =
    wins.length > 0 ? Math.round((wins.reduce((a, b) => a + b, 0) / wins.length) * 10) / 10 : null
  const avgLoss =
    losses.length > 0
      ? Math.round((losses.reduce((a, b) => a + b, 0) / losses.length) * 10) / 10
      : null
  const profitFactor =
    avgWin != null && avgLoss != null && avgLoss !== 0
      ? Math.round((avgWin / Math.abs(avgLoss)) * 100) / 100
      : null

  const holdingDays = filtered.map((t) => t.holdingDays ?? 0).filter((d) => d >= 0)
  const avgHoldingDays =
    holdingDays.length > 0
      ? Math.round((holdingDays.reduce((a, b) => a + b, 0) / holdingDays.length) * 10) / 10
      : null

  const sortedClosed = [...closed].sort((a, b) =>
    String(a.closedAt ?? a.entryDate).localeCompare(String(b.closedAt ?? b.entryDate)),
  )
  let cumulative = 0
  /** @type {{ date: string; cumulative: number; trade: string }[]} */
  const cumulativeCurve = []
  for (const t of sortedClosed) {
    const r = tradeReturnPct(t) ?? 0
    cumulative = Math.round((cumulative + r) * 10) / 10
    cumulativeCurve.push({
      date: String(t.closedAt ?? t.entryDate).slice(0, 10),
      cumulative,
      trade: t.name,
    })
  }
  if (open.length) {
    const openSum = open.reduce((s, t) => s + (tradeReturnPct(t) ?? 0), 0)
    cumulative = Math.round((cumulative + openSum) * 10) / 10
    cumulativeCurve.push({
      date: new Date().toISOString().slice(0, 10),
      cumulative,
      trade: `OPEN ${open.length}건`,
    })
  }

  const mddPct = computeMddPct(cumulativeCurve.map((p) => p.cumulative))

  /** @type {Record<string, { month: string; returns: number[]; wins: number; count: number }>} */
  const monthMap = {}
  for (const t of closed) {
    const m = String(t.closedAt ?? t.entryDate).slice(0, 7)
    if (!monthMap[m]) monthMap[m] = { month: m, returns: [], wins: 0, count: 0 }
    const r = tradeReturnPct(t) ?? 0
    monthMap[m].returns.push(r)
    monthMap[m].count += 1
    if (r > 0) monthMap[m].wins += 1
  }
  const monthlyPerformance = Object.values(monthMap)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((row) => ({
      month: row.month,
      avgReturn: Math.round((row.returns.reduce((a, b) => a + b, 0) / row.returns.length) * 10) / 10,
      winRate: Math.round((row.wins / row.count) * 1000) / 10,
      count: row.count,
    }))

  const winRateTrend = monthlyPerformance.map((m) => ({
    month: m.month,
    winRate: m.winRate,
  }))

  const gradeStats = PERFORMANCE_GRADES.map((grade) => {
    const rows = filtered.filter((t) => t.entryGrade === grade)
    const rets = rows.map((t) => tradeReturnPct(t)).filter((v) => v != null)
    const w = rets.filter((r) => r > 0).length
    return {
      grade,
      count: rows.length,
      winRate: rets.length ? Math.round((w / rets.length) * 1000) / 10 : null,
      avgReturn:
        rets.length > 0
          ? Math.round((rets.reduce((a, b) => a + b, 0) / rets.length) * 10) / 10
          : null,
    }
  })

  const sectorStats = PERFORMANCE_SECTORS.map((sector) => {
    const rows = filtered.filter((t) => inferPaperPositionSectorKey(t) === sector.id)
    const rets = rows.map((t) => tradeReturnPct(t)).filter((v) => v != null)
    const w = rets.filter((r) => r > 0).length
    return {
      sectorId: sector.id,
      label: sector.label,
      count: rows.length,
      winRate: rets.length ? Math.round((w / rets.length) * 1000) / 10 : null,
      avgReturn:
        rets.length > 0
          ? Math.round((rets.reduce((a, b) => a + b, 0) / rets.length) * 10) / 10
          : null,
    }
  })

  const performers = filtered
    .map((t) => ({
      id: t.id,
      name: t.name,
      grade: t.entryGrade,
      sectorKey: inferPaperPositionSectorKey(t),
      status: t.status,
      returnPct: tradeReturnPct(t) ?? 0,
      holdingDays: t.holdingDays ?? 0,
    }))
    .sort((a, b) => b.returnPct - a.returnPct)

  const top10 = performers.slice(0, 10)
  const worst10 = [...performers].sort((a, b) => a.returnPct - b.returnPct).slice(0, 10)

  return {
    label: PERFORMANCE_DASHBOARD_LABEL,
    title: "Performance Dashboard",
    available: filtered.length > 0,
    period,
    periodLabel: PERFORMANCE_PERIOD_FILTERS.find((f) => f.id === period)?.label ?? period,
    counts: {
      total: filtered.length,
      open: open.length,
      closed: closed.length,
    },
    summary: {
      totalTrades: filtered.length,
      winRate:
        closedReturns.length > 0
          ? Math.round((wins.length / closedReturns.length) * 1000) / 10
          : null,
      winRateDisplay:
        closedReturns.length > 0
          ? `${formatMetric((wins.length / closedReturns.length) * 100, 1)}%`
          : "—",
      avgProfitPct: avgProfit,
      avgProfitDisplay: formatJournalReturnPct(avgProfit),
      avgHoldingDays,
      maxProfitPct: closedReturns.length ? Math.max(...closedReturns) : null,
      maxProfitDisplay: formatJournalReturnPct(
        closedReturns.length ? Math.max(...closedReturns) : null,
      ),
      maxLossPct: closedReturns.length ? Math.min(...closedReturns) : null,
      maxLossDisplay: formatJournalReturnPct(
        closedReturns.length ? Math.min(...closedReturns) : null,
      ),
      profitFactor,
      profitFactorDisplay: profitFactor != null ? formatMetric(profitFactor, 2) : "—",
      mddPct,
      mddDisplay: mddPct != null ? `${formatMetric(mddPct, 1)}%` : "—",
    },
    charts: {
      cumulativeCurve,
      monthlyPerformance,
      winRateTrend,
    },
    gradeStats,
    sectorStats,
    top10,
    worst10,
    pipeline: PERFORMANCE_DASHBOARD_PIPELINE,
    notes: [
      "Paper Trading OPEN·CLOSED 기준 · 실제 매매 아님",
      "YDS 엔진 미수정 · 독립 집계 모듈",
      "C/D 등급은 Paper 자동생성 대상 아님(0건 가능)",
    ],
  }
}

/**
 * @param {PerformancePeriodFilter} [period]
 */
export function buildPerformanceDashboardFromPaperTrading(period = "all") {
  const state = refreshPaperTradingPrices(loadPaperTrading())
  return buildPerformanceDashboardReport(state.positions, period)
}
