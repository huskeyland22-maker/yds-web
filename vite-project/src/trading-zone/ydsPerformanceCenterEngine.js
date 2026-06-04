import { formatMetric } from "./ydsHistoricalEventTypes.js"
import { formatJournalReturnPct } from "./ydsPrecursorEnginePhase28.js"
import {
  buildPerformanceDashboardReport,
  PERFORMANCE_SECTORS,
} from "./ydsPerformanceDashboardEngine.js"
import {
  loadPaperTrading,
  refreshPaperTradingPrices,
  inferPaperPositionSectorKey,
} from "./ydsPaperTradingStorage.js"

export const PERFORMANCE_CENTER_LABEL = "Performance Center — Phase 33"

/** 동기간 벤치마크 추정용 연율 프록시(검증·공개 레이어, 실시간 시세 아님) */
const BENCHMARK_ANNUAL_PROXY = {
  sp500: 10.5,
  qqq: 13.8,
  soxx: 16.5,
  kospi: 5.2,
}

/** @type {Record<string, number>} */
const GRADE_SCORE_PROXY = { A: 88, B: 72, C: 58, D: 42 }

/**
 * @param {import("./ydsPaperTradingStorage.js").PaperPositionRow} row
 */
function tradeReturnPct(row) {
  if (row.status === "CLOSED") return row.returnPct
  return row.currentProfitPct ?? row.returnPct
}

/**
 * @param {string} start
 * @param {string} end
 */
function periodYears(start, end) {
  const a = Date.parse(start)
  const b = Date.parse(end)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 1
  return Math.max(0.25, (b - a) / (365.25 * 86400000))
}

/**
 * @param {number} annualPct
 * @param {number} years
 */
function scaleAnnualReturn(annualPct, years) {
  return Math.round(annualPct * years * 10) / 10
}

/**
 * @param {ReturnType<typeof loadPaperTrading>["positions"]} positions
 */
function resolveTrackingWindow(positions) {
  if (!positions.length) {
    const today = new Date().toISOString().slice(0, 10)
    return { start: today, end: today }
  }
  const dates = positions.flatMap((p) => [p.entryDate, p.closedAt, p.createdAt].filter(Boolean))
  const sorted = [...dates].sort()
  return {
    start: sorted[0] ?? new Date().toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
  }
}

/**
 * @param {ReturnType<typeof buildPerformanceDashboardReport>} dash
 * @param {ReturnType<typeof loadPaperTrading>["positions"]} positions
 */
export function buildPerformanceCenterReport(positions) {
  const dash = buildPerformanceDashboardReport(positions, "all")
  const closed = positions.filter((p) => p.status === "CLOSED")
  const closedReturns = closed
    .map((t) => tradeReturnPct(t))
    .filter((v) => v != null && Number.isFinite(v))

  const wins = closedReturns.filter((r) => r > 0)
  const losses = closedReturns.filter((r) => r < 0)
  const avgWin =
    wins.length > 0
      ? Math.round((wins.reduce((a, b) => a + b, 0) / wins.length) * 10) / 10
      : null
  const avgLoss =
    losses.length > 0
      ? Math.round((losses.reduce((a, b) => a + b, 0) / losses.length) * 10) / 10
      : null

  const cumulativeReturnPct =
    dash.charts.cumulativeCurve.length > 0
      ? dash.charts.cumulativeCurve[dash.charts.cumulativeCurve.length - 1].cumulative
      : null

  const window = resolveTrackingWindow(positions)
  const years = periodYears(window.start, window.end)

  const ydsReturn = cumulativeReturnPct ?? 0
  const benchmarks = [
    { id: "yds", label: "YDS", returnPct: ydsReturn, isPrimary: true },
    {
      id: "sp500",
      label: "S&P500",
      returnPct: scaleAnnualReturn(BENCHMARK_ANNUAL_PROXY.sp500, years),
    },
    { id: "qqq", label: "QQQ", returnPct: scaleAnnualReturn(BENCHMARK_ANNUAL_PROXY.qqq, years) },
    { id: "soxx", label: "SOXX", returnPct: scaleAnnualReturn(BENCHMARK_ANNUAL_PROXY.soxx, years) },
    {
      id: "kospi",
      label: "KOSPI",
      returnPct: scaleAnnualReturn(BENCHMARK_ANNUAL_PROXY.kospi, years),
    },
  ].map((b) => ({
    ...b,
    returnDisplay: formatJournalReturnPct(b.returnPct),
    vsYds:
      b.id === "yds"
        ? null
        : Math.round((ydsReturn - b.returnPct) * 10) / 10,
    vsYdsDisplay:
      b.id === "yds"
        ? "—"
        : formatJournalReturnPct(Math.round((ydsReturn - b.returnPct) * 10) / 10),
  }))

  const yearsAvailable = [
    ...new Set(
      positions.flatMap((p) => {
        const d = p.entryDate ?? p.createdAt
        return d ? [String(d).slice(0, 4)] : []
      }),
    ),
  ].sort((a, b) => b.localeCompare(a))

  const defaultYear = yearsAvailable[0] ?? String(new Date().getFullYear())

  const recommendationHistory = [...positions]
    .sort((a, b) => String(b.entryDate).localeCompare(String(a.entryDate)))
    .map((p) => {
      const ret = tradeReturnPct(p)
      const grade = p.entryGrade ?? "B"
      return {
        id: p.id,
        recommendedAt: p.entryDate ?? p.createdAt,
        name: p.name,
        symbol: p.symbol,
        score: GRADE_SCORE_PROXY[grade] ?? 70,
        scoreDisplay: String(GRADE_SCORE_PROXY[grade] ?? "—"),
        grade,
        returnPct: ret,
        returnDisplay: formatJournalReturnPct(ret),
        status: p.status,
        statusLabel: p.status === "OPEN" ? "보유중" : "청산",
        sectorKey: inferPaperPositionSectorKey(p),
      }
    })

  const sectorStats = PERFORMANCE_SECTORS.map((sector) => {
    const rows = positions.filter((t) => inferPaperPositionSectorKey(t) === sector.id)
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
  }).filter((s) => s.count > 0)

  const bestSector = [...sectorStats].sort(
    (a, b) => (b.winRate ?? 0) - (a.winRate ?? 0) || (b.avgReturn ?? 0) - (a.avgReturn ?? 0),
  )[0]

  const gradeStats = dash.gradeStats.filter((g) => g.count > 0)
  const bestStrategy = [...gradeStats].sort(
    (a, b) => (b.avgReturn ?? 0) - (a.avgReturn ?? 0),
  )[0]

  const bestStock = dash.top10[0] ?? null

  return {
    label: PERFORMANCE_CENTER_LABEL,
    title: "성과센터",
    available: positions.length > 0,
    trackingWindow: window,
    benchmarkNote:
      "벤치마크는 Paper Trading 추적 구간 대비 연율 프록시 추정 · 실시간 지수 수익률 아님",
    sectionA: {
      cumulativeReturnPct,
      cumulativeReturnDisplay: formatJournalReturnPct(cumulativeReturnPct),
      winRate: dash.summary.winRate,
      winRateDisplay: dash.summary.winRateDisplay,
      avgProfitDisplay: dash.summary.avgProfitDisplay,
      avgWinDisplay: formatJournalReturnPct(avgWin),
      avgLossDisplay: formatJournalReturnPct(avgLoss),
      profitFactorDisplay: dash.summary.profitFactorDisplay,
      mddDisplay: dash.summary.mddDisplay,
      totalTrades: dash.summary.totalTrades,
    },
    sectionB: { benchmarks },
    sectionC: {
      yearsAvailable,
      defaultYear,
    },
    sectionD: { rows: recommendationHistory },
    sectionE: {
      bestStock: bestStock
        ? {
            name: bestStock.name,
            returnDisplay: formatJournalReturnPct(bestStock.returnPct),
            grade: bestStock.grade,
          }
        : null,
      bestSector: bestSector
        ? {
            label: bestSector.label,
            winRateDisplay:
              bestSector.winRate != null ? `${formatMetric(bestSector.winRate, 1)}%` : "—",
            avgReturnDisplay: formatJournalReturnPct(bestSector.avgReturn),
          }
        : null,
      bestStrategy: bestStrategy
        ? {
            label: `${bestStrategy.grade} 등급`,
            winRateDisplay:
              bestStrategy.winRate != null
                ? `${formatMetric(bestStrategy.winRate, 1)}%`
                : "—",
            avgReturnDisplay: formatJournalReturnPct(bestStrategy.avgReturn),
          }
        : null,
    },
    counts: dash.counts,
    notes: [
      "Paper Trading OPEN·CLOSED 기준 · YDS 추천 성과 공개",
      "YDS 엔진 미수정 · 성과 집계 레이어만",
      dash.notes[2],
    ],
  }
}

/**
 * @param {ReturnType<typeof loadPaperTrading>["positions"]} positions
 * @param {string} year
 */
export function buildMonthlyTableForYear(positions, year) {
  /** @type {Record<string, number[]>} */
  const byMonth = {}
  for (let m = 1; m <= 12; m++) {
    byMonth[String(m).padStart(2, "0")] = []
  }

  for (const p of positions) {
    const anchor = p.closedAt ?? p.entryDate
    if (!anchor || !String(anchor).startsWith(year)) continue
    const month = String(anchor).slice(5, 7)
    const r = tradeReturnPct(p)
    if (r != null && Number.isFinite(r)) byMonth[month].push(r)
  }

  return Object.entries(byMonth).map(([month, returns]) => {
    const monthNum = Number(month)
    const label = `${year}-${month}`
    const avg =
      returns.length > 0
        ? Math.round((returns.reduce((a, b) => a + b, 0) / returns.length) * 10) / 10
        : null
    return {
      month,
      monthNum,
      label,
      monthLabel: `${monthNum}월`,
      count: returns.length,
      returnPct: avg,
      returnDisplay: avg != null ? formatJournalReturnPct(avg) : "—",
      tone: avg == null ? "neutral" : avg > 0 ? "up" : avg < 0 ? "down" : "neutral",
    }
  })
}

export function buildPerformanceCenterFromPaperTrading() {
  const state = refreshPaperTradingPrices(loadPaperTrading())
  return buildPerformanceCenterReport(state.positions)
}

/**
 * @param {string} year
 */
export function buildMonthlyTableForYearFromPaper(year) {
  const state = refreshPaperTradingPrices(loadPaperTrading())
  return buildMonthlyTableForYear(state.positions, year)
}
