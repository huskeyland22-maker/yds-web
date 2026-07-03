/**
 * AI 성과 대시보드 — 영구 추천 원장(rec-ID) 기반 누적 성과 집계
 */

import { buildHubHistoryViewRows } from "./ydsHubHistoryViewEngine.js"
import { benchmarkReturnBetween } from "./ydsValidationBenchmarks.js"
import { loadValidationBenchmarkLog } from "./ydsValidationStorage.js"
import { todayDateKey } from "./ydsPortfolioTradesStorage.js"
import { SCORE_BUCKETS } from "./ydsPickScoreCorrelation.js"

/** @typedef {'all' | 'd30' | 'd90' | 'year' | 'custom'} DashboardPeriodId */

/**
 * @typedef {
 *   | 'kpi-total'
 *   | 'kpi-active'
 *   | 'kpi-ended'
 *   | 'kpi-win'
 *   | 'kpi-avg-return'
 *   | 'kpi-avg-hold'
 *   | 'kpi-max-return'
 *   | 'kpi-max-loss'
 *   | `score-${string}`
 *   | 'country-kr'
 *   | 'country-us'
 *   | `market-${string}`
 *   | `panic-${string}`
 * } DashboardDrillId
 */

/** @type {ReadonlyArray<{ id: string; label: string; min: number; max: number }>} */
export const DASHBOARD_PANIC_DRILL_BUCKETS = [
  { id: "panic-0-15", label: "0~15", min: 0, max: 15 },
  { id: "panic-16-30", label: "16~30", min: 16, max: 30 },
  { id: "panic-31-45", label: "31~45", min: 31, max: 45 },
  { id: "panic-46-60", label: "46~60", min: 46, max: 60 },
  { id: "panic-61-80", label: "61~80", min: 61, max: 80 },
  { id: "panic-81-100", label: "81~100", min: 81, max: 100 },
]

/** @type {ReadonlyArray<{ id: string; label: string }>} */
export const DASHBOARD_MARKET_DRILL_GROUPS = [
  { id: "market-bull", label: "강세" },
  { id: "market-correct", label: "조정" },
  { id: "market-bear", label: "약세" },
]

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
 * @param {ReturnType<typeof buildHubHistoryViewRows>[number]} row
 */
export function resolveDashboardMarketDrillId(row) {
  const label = String(
    row.marketLedger?.marketStateLabel ?? row.marketLedger?.strategyLabel ?? "",
  )
  if (!label || label === "—") return null
  const lower = label.toLowerCase()
  if (/강세|리스크.?온|탐욕|상승|bull|risk.?on/.test(lower) || label.includes("강")) {
    return "market-bull"
  }
  if (/약세|리스크.?오프|공포|방어|bear|risk.?off|하락/.test(lower) || label.includes("약")) {
    return "market-bear"
  }
  if (/조정|중립|안정|neutral|sideways/.test(lower) || label.includes("조정")) {
    return "market-correct"
  }
  return "market-correct"
}

/**
 * @param {ReturnType<typeof buildHubHistoryViewRows>[number][]} rows
 * @param {DashboardDrillId | null | undefined} drillId
 */
export function filterDashboardRowsByDrilldown(rows, drillId) {
  if (!drillId || drillId === "all") return rows ?? []
  const list = rows ?? []

  if (drillId === "kpi-total") return list
  if (drillId === "kpi-active") return list.filter((row) => row.lifecycleId === "active")
  if (drillId === "kpi-ended") return list.filter((row) => row.lifecycleId !== "active")
  if (drillId === "kpi-win") {
    return list.filter((row) => row.returnPct != null && row.returnPct > 0)
  }
  if (drillId === "kpi-avg-return") {
    return list.filter((row) => row.returnPct != null && Number.isFinite(row.returnPct))
  }
  if (drillId === "kpi-avg-hold") {
    return list.filter((row) => row.daysSinceRecommend != null && Number.isFinite(row.daysSinceRecommend))
  }
  if (drillId === "kpi-max-return") {
    const valid = list.filter((row) => row.returnPct != null && Number.isFinite(row.returnPct))
    if (!valid.length) return []
    const max = Math.max(...valid.map((row) => row.returnPct))
    return valid.filter((row) => row.returnPct === max)
  }
  if (drillId === "kpi-max-loss") {
    const valid = list.filter((row) => row.returnPct != null && Number.isFinite(row.returnPct))
    if (!valid.length) return []
    const min = Math.min(...valid.map((row) => row.returnPct))
    return valid.filter((row) => row.returnPct === min)
  }
  if (drillId.startsWith("score-")) {
    const bucketId = drillId.replace("score-", "")
    const bucket = SCORE_BUCKETS.find((item) => item.id === bucketId)
    if (!bucket) return list
    return list.filter((row) => {
      if (row.aiScore == null) return false
      if (bucket.max == null) return row.aiScore >= bucket.min
      return row.aiScore >= bucket.min && row.aiScore <= bucket.max
    })
  }
  if (drillId === "country-kr") return list.filter((row) => row.country === "KR")
  if (drillId === "country-us") return list.filter((row) => row.country === "US")
  if (drillId.startsWith("market-")) {
    return list.filter((row) => resolveDashboardMarketDrillId(row) === drillId)
  }
  if (drillId.startsWith("panic-")) {
    const bucket = DASHBOARD_PANIC_DRILL_BUCKETS.find((item) => item.id === drillId)
    if (!bucket) return list
    return list.filter((row) => {
      const intensity = row.marketLedger?.panicIntensity ?? row.pickPanicIntensity ?? null
      if (intensity == null || !Number.isFinite(intensity)) return false
      return intensity >= bucket.min && intensity <= bucket.max
    })
  }
  return list
}

/** @param {DashboardDrillId | null | undefined} drillId */
export function resolveDashboardDrillLabel(drillId) {
  if (!drillId) return "전체"
  const kpiLabels = {
    "kpi-total": "총 추천",
    "kpi-active": "진행 중",
    "kpi-ended": "종료",
    "kpi-win": "승률 (수익)",
    "kpi-avg-return": "평균 수익률",
    "kpi-avg-hold": "평균 보유기간",
    "kpi-max-return": "최고 수익률",
    "kpi-max-loss": "최대 손실률",
  }
  if (kpiLabels[drillId]) return kpiLabels[drillId]
  if (drillId.startsWith("score-")) {
    const bucket = SCORE_BUCKETS.find((item) => item.id === drillId.replace("score-", ""))
    return bucket ? `AI 점수 ${bucket.label}` : drillId
  }
  if (drillId === "country-kr") return "KR"
  if (drillId === "country-us") return "US"
  const market = DASHBOARD_MARKET_DRILL_GROUPS.find((item) => item.id === drillId)
  if (market) return `시장 ${market.label}`
  const panic = DASHBOARD_PANIC_DRILL_BUCKETS.find((item) => item.id === drillId)
  if (panic) return `패닉 ${panic.label}`
  return drillId
}

/**
 * @param {ReturnType<typeof buildHubHistoryViewRows>[number][]} rows
 */
export function buildDashboardAnalysisBreakdown(rows) {
  const list = rows ?? []
  return {
    score: SCORE_BUCKETS.map((bucket) => ({
      id: /** @type {DashboardDrillId} */ (`score-${bucket.id}`),
      label: bucket.label,
      count: filterDashboardRowsByDrilldown(list, `score-${bucket.id}`).length,
    })).filter((item) => item.count > 0),
    country: [
      { id: /** @type {DashboardDrillId} */ ("country-kr"), label: "KR" },
      { id: /** @type {DashboardDrillId} */ ("country-us"), label: "US" },
    ]
      .map((item) => ({
        ...item,
        count: filterDashboardRowsByDrilldown(list, item.id).length,
      }))
      .filter((item) => item.count > 0),
    market: DASHBOARD_MARKET_DRILL_GROUPS.map((item) => ({
      id: /** @type {DashboardDrillId} */ (item.id),
      label: item.label,
      count: filterDashboardRowsByDrilldown(list, item.id).length,
    })).filter((item) => item.count > 0),
    panic: DASHBOARD_PANIC_DRILL_BUCKETS.map((item) => ({
      id: /** @type {DashboardDrillId} */ (item.id),
      label: item.label,
      count: filterDashboardRowsByDrilldown(list, item.id).length,
    })).filter((item) => item.count > 0),
  }
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
      analysis: { score: [], country: [], market: [], panic: [] },
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
    analysis: buildDashboardAnalysisBreakdown(rowsWithAlpha),
    periodLabel:
      AI_DASHBOARD_PERIOD_FILTERS.find((item) => item.id === periodId)?.label ?? "전체",
    availableRange: {
      min: allDates[0] ?? null,
      max: allDates[allDates.length - 1] ?? null,
    },
  }
}
