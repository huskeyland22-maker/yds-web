/**
 * AI 성과 대시보드 — 영구 추천 원장(rec-ID) 기반 누적 성과 집계
 */

import { buildHubHistoryViewRows } from "./ydsHubHistoryViewEngine.js"
import { benchmarkReturnBetween } from "./ydsValidationBenchmarks.js"
import { loadValidationBenchmarkLog } from "./ydsValidationStorage.js"
import { todayDateKey } from "./ydsPortfolioTradesStorage.js"

/** @typedef {'all' | 'd30' | 'd90' | 'year' | 'custom'} DashboardPeriodId */

/** @type {ReadonlyArray<{ id: DashboardPeriodId; label: string }>} */
export const AI_DASHBOARD_PERIOD_FILTERS = [
  { id: "all", label: "전체" },
  { id: "d30", label: "최근 30일" },
  { id: "d90", label: "최근 90일" },
  { id: "year", label: "올해" },
  { id: "custom", label: "직접 선택" },
]

/** @param {number | null | undefined} value */
function round1(value) {
  return value != null && Number.isFinite(value) ? Math.round(value * 10) / 10 : null
}

/** @param {number | null | undefined} value */
function pctLabel(value) {
  return value == null || !Number.isFinite(value) ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)}%`
}

/** @param {number | null | undefined} value */
function dayLabel(value) {
  return value == null || !Number.isFinite(value) ? "—" : `${Math.round(value)}일`
}

/**
 * @param {string} dateKey
 * @param {number} days
 */
function subtractDays(dateKey, days) {
  const d = new Date(`${String(dateKey).slice(0, 10)}T12:00:00`)
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

/**
 * @param {ReturnType<typeof buildHubHistoryViewRows>[number]} row
 * @param {DashboardPeriodId} periodId
 * @param {string | null | undefined} customStart
 * @param {string | null | undefined} customEnd
 */
export function isRowInDashboardPeriod(row, periodId, customStart, customEnd) {
  const date = String(row?.recommendedAt ?? "").slice(0, 10)
  const today = todayDateKey()
  if (!date) return false
  if (periodId === "all") return true
  if (periodId === "d30") return date >= subtractDays(today, 30) && date <= today
  if (periodId === "d90") return date >= subtractDays(today, 90) && date <= today
  if (periodId === "year") return date >= `${today.slice(0, 4)}-01-01` && date <= today
  if (periodId === "custom") {
    const start = String(customStart ?? "").slice(0, 10)
    const end = String(customEnd ?? "").slice(0, 10) || today
    if (!start) return date <= end
    return date >= start && date <= end
  }
  return true
}

/**
 * @param {ReturnType<typeof buildHubHistoryViewRows>[number][]} rows
 * @param {DashboardPeriodId} periodId
 * @param {string | null | undefined} customStart
 * @param {string | null | undefined} customEnd
 */
export function filterDashboardRowsByPeriod(rows, periodId, customStart, customEnd) {
  return (rows ?? []).filter((row) => isRowInDashboardPeriod(row, periodId, customStart, customEnd))
}

/**
 * @param {ReturnType<typeof buildHubHistoryViewRows>[number][]} rows
 */
function buildMonthlySeries(rows) {
  /** @type {Map<string, number[]>} */
  const byMonth = new Map()
  for (const row of rows ?? []) {
    if (row.returnPct == null || !Number.isFinite(row.returnPct)) continue
    const month = String(row.recommendedAt).slice(0, 7)
    if (!byMonth.has(month)) byMonth.set(month, [])
    byMonth.get(month).push(Number(row.returnPct))
  }
  let cumulative = 0
  return [...byMonth.keys()].sort().map((month) => {
    const vals = byMonth.get(month) ?? []
    const wins = vals.filter((v) => v > 0).length
    const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
    cumulative += avg ?? 0
    return {
      month,
      monthLabel: month.replace("-", "."),
      count: vals.length,
      winRate: vals.length ? round1((wins / vals.length) * 100) : null,
      avgReturn: round1(avg),
      cumulativeReturn: round1(cumulative),
    }
  })
}

/**
 * @param {ReturnType<typeof buildHubHistoryViewRows>[number][]} rows
 */
function buildAlphaSeries(rows) {
  const benchLog = loadValidationBenchmarkLog()
  const benchDates = Object.keys(benchLog).sort()
  const latestBenchDate = benchDates[benchDates.length - 1] ?? todayDateKey()
  return rows.map((row) => {
    const benchmarkId = row.country === "KR" ? "KOSPI" : "SPY"
    const benchRet = benchmarkReturnBetween(benchLog, benchmarkId, row.recommendedAt, latestBenchDate)
    const alpha =
      row.returnPct != null && benchRet != null && Number.isFinite(row.returnPct) && Number.isFinite(benchRet)
        ? round1(row.returnPct - benchRet)
        : null
    return {
      ...row,
      benchmarkId,
      benchmarkReturnPct: benchRet != null && Number.isFinite(benchRet) ? round1(benchRet) : null,
      alpha,
    }
  })
}

/**
 * @param {ReturnType<typeof buildAlphaSeries>} rows
 */
function buildDashboardKpis(rows) {
  const returns = rows
    .map((row) => row.returnPct)
    .filter((value) => value != null && Number.isFinite(value))
    .map(Number)
  const holdDays = rows
    .map((row) => row.daysSinceRecommend)
    .filter((value) => value != null && Number.isFinite(value))
    .map(Number)
  const alphas = rows
    .map((row) => row.alpha)
    .filter((value) => value != null && Number.isFinite(value))
    .map(Number)

  const totalCount = rows.length
  const activeCount = rows.filter((row) => row.lifecycleId === "active").length
  const endedCount = rows.filter((row) => row.lifecycleId !== "active").length
  const winCount = returns.filter((value) => value > 0).length
  const avgReturn = returns.length ? round1(returns.reduce((s, v) => s + v, 0) / returns.length) : null
  const avgHoldDays = holdDays.length ? round1(holdDays.reduce((s, v) => s + v, 0) / holdDays.length) : null
  const maxReturn = returns.length ? round1(Math.max(...returns)) : null
  const maxLoss = returns.length ? round1(Math.min(...returns)) : null
  const winRate = returns.length ? round1((winCount / returns.length) * 100) : null

  const rows90 = rows.filter((row) => row.aiScore != null && row.aiScore >= 90)
  const krRows = rows.filter((row) => row.country === "KR")
  const usRows = rows.filter((row) => row.country === "US")
  const outperformCount = alphas.filter((value) => value > 0).length

  const ratio = (subset) => {
    const valid = subset
      .map((row) => row.returnPct)
      .filter((value) => value != null && Number.isFinite(value))
      .map(Number)
    if (!valid.length) return null
    return round1((valid.filter((value) => value > 0).length / valid.length) * 100)
  }

  return {
    totalCount,
    activeCount,
    endedCount,
    winRate,
    avgReturn,
    avgHoldDays,
    maxReturn,
    maxLoss,
    score90WinRate: ratio(rows90),
    krWinRate: ratio(krRows),
    usWinRate: ratio(usRows),
    outperformRate: alphas.length ? round1((outperformCount / alphas.length) * 100) : null,
    avgAlpha: alphas.length ? round1(alphas.reduce((s, v) => s + v, 0) / alphas.length) : null,
  }
}

/**
 * @param {ReturnType<typeof buildAlphaSeries>} rows
 */
function buildTopMovers(rows) {
  const valid = rows.filter((row) => row.returnPct != null && Number.isFinite(row.returnPct))
  const best = [...valid].sort((a, b) => b.returnPct - a.returnPct)[0] ?? null
  const worst = [...valid].sort((a, b) => a.returnPct - b.returnPct)[0] ?? null
  return { best, worst }
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView[]} [stocks]
 * @param {{ periodId?: DashboardPeriodId; customStart?: string | null; customEnd?: string | null }} [options]
 */
export function buildAiPerformanceDashboardReport(stocks = [], options = {}) {
  const periodId = options.periodId ?? "all"
  const customStart = options.customStart ?? null
  const customEnd = options.customEnd ?? null
  const allRows = buildHubHistoryViewRows(stocks)
  const filteredRows = filterDashboardRowsByPeriod(allRows, periodId, customStart, customEnd)
  const rowsWithAlpha = buildAlphaSeries(filteredRows)
  const allDates = allRows.map((row) => String(row.recommendedAt).slice(0, 10)).filter(Boolean).sort()

  if (!allRows.length) {
    return {
      visible: false,
      title: "AI 성과 대시보드",
      subtitle: "영구 추천 원장 기반 누적 성과 검증",
      rows: [],
      kpis: null,
      monthly: [],
      topMovers: null,
      periodLabel: "전체",
      availableRange: { min: null, max: null },
    }
  }

  return {
    visible: true,
    title: "AI 성과 대시보드",
    subtitle: "영구 추천 원장(rec-ID) 기반으로 AI의 누적 성과를 자동 집계합니다.",
    rows: rowsWithAlpha,
    kpis: buildDashboardKpis(rowsWithAlpha),
    monthly: buildMonthlySeries(rowsWithAlpha),
    topMovers: buildTopMovers(rowsWithAlpha),
    periodLabel:
      AI_DASHBOARD_PERIOD_FILTERS.find((item) => item.id === periodId)?.label ?? "전체",
    availableRange: {
      min: allDates[0] ?? null,
      max: allDates[allDates.length - 1] ?? null,
    },
  }
}
