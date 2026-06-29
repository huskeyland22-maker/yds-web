/**
 * GO #86 — AI 추천 백테스트 엔진
 */

import { loadValidationBenchmarkLog } from "./ydsValidationStorage.js"
import { calcRecommendReturnPct } from "../trading-zone/tradingZoneRecommendationTrack.js"
import { todayDateKey } from "./ydsPortfolioTradesStorage.js"
import { subtractCalendarDays } from "./ydsValidationEngine.js"
import {
  buildMonthlySeries,
  buildTopCases,
  filterPicksInWindow,
  formatPerfPct,
  summarizeHorizonReturns,
} from "./ydsPickPerformanceEngine.js"
import { buildMddAnalysisReport } from "./ydsPickMddAnalysis.js"
import { classifyPickOutcome } from "./ydsPickOutcomeEngine.js"

/** @typedef {import("./ydsValidationStorage.js").ValidationPickRecord} ValidationPickRecord */

export const BACKTEST_PERIODS = [
  { key: "d7", label: "7일", days: 7, horizonKey: "d7" },
  { key: "d30", label: "30일", days: 30, horizonKey: "d30" },
  { key: "d90", label: "90일", days: 90, horizonKey: "d90" },
  { key: "d180", label: "180일", days: 180, horizonKey: "d180" },
  { key: "d365", label: "1년", days: 365, horizonKey: "d365" },
]

/** @param {number[]} returns */
function computeSharpe(returns) {
  if (returns.length < 2) return null
  const avg = returns.reduce((s, v) => s + v, 0) / returns.length
  const variance = returns.reduce((s, v) => s + (v - avg) ** 2, 0) / (returns.length - 1)
  const std = Math.sqrt(variance)
  if (std <= 0) return null
  return Math.round((avg / std) * 100) / 100
}

/**
 * @param {ValidationPickRecord[]} picks
 * @param {string} horizonKey
 */
function estimateAlpha(picks, horizonKey, windowDays) {
  const rows = picks.filter((p) => p.horizons?.[horizonKey] != null)
  if (!rows.length) return null
  const pickAvg = rows.reduce((s, p) => s + Number(p.horizons[horizonKey]), 0) / rows.length

  const benchLog = loadValidationBenchmarkLog()
  const dates = Object.keys(benchLog).sort()
  if (dates.length < 2) return null
  const endDate = dates[dates.length - 1]
  const startDate = subtractCalendarDays(endDate, windowDays)
  const spyStart = benchLog[startDate]?.SPY ?? benchLog[dates[0]]?.SPY
  const spyEnd = benchLog[endDate]?.SPY
  const benchRet = calcRecommendReturnPct(spyStart, spyEnd)
  if (benchRet == null) return null
  return Math.round((pickAvg - benchRet) * 10) / 10
}

/**
 * @param {ValidationPickRecord[]} allPicks
 * @param {number} windowDays
 */
export function buildStockPickBacktestReport(allPicks, windowDays = 30) {
  const period =
    BACKTEST_PERIODS.find((p) => p.days === windowDays) ?? BACKTEST_PERIODS[1]
  const picks = filterPicksInWindow(allPicks, windowDays)
  const horizonKey = period.horizonKey
  const stats = summarizeHorizonReturns(picks, horizonKey)

  const returns = picks
    .map((p) => p.horizons?.[horizonKey])
    .filter((v) => v != null && Number.isFinite(v))
    .map(Number)

  const wins = returns.filter((v) => classifyPickOutcome(v) === "success").length
  const winRate = returns.length ? Math.round((wins / returns.length) * 1000) / 10 : null
  const avgReturn = stats.avgReturn
  const sharpe = computeSharpe(returns)
  const alpha = estimateAlpha(picks, horizonKey, windowDays)
  const mddReport = buildMddAnalysisReport(picks)
  const mddRow = mddReport.horizons?.find((h) => h.key === "d30") ?? mddReport.horizons?.[0]

  const monthly = buildMonthlySeries(picks, horizonKey === "d7" ? "d30" : horizonKey)
  let cumulative = 0
  const equityCurve = monthly.map((m) => {
    cumulative += m.avgReturn ?? 0
    return {
      date: m.monthLabel,
      cumulative: Math.round(cumulative * 10) / 10,
      monthly: m.avgReturn,
    }
  })

  const perPick = picks
    .filter((p) => p.horizons?.[horizonKey] != null)
    .map((p) => ({
      ticker: p.ticker,
      name: p.name,
      recommendedAt: p.recommendedAt,
      returnPct: Number(p.horizons[horizonKey]),
      returnLabel: formatPerfPct(Number(p.horizons[horizonKey])),
      success: classifyPickOutcome(Number(p.horizons[horizonKey])) === "success",
    }))
    .sort((a, b) => b.returnPct - a.returnPct)

  const best = buildTopCases(picks, "best", 5, horizonKey)
  const worst = buildTopCases(picks, "worst", 5, horizonKey)

  return {
    visible: picks.length > 0 || (allPicks ?? []).length > 0,
    title: "AI 추천 백테스트",
    period,
    windowDays,
    kpi: {
      pickCount: picks.length,
      cumulativeReturn: equityCurve.length ? equityCurve[equityCurve.length - 1].cumulative : avgReturn,
      winRate,
      avgReturn,
      mdd: mddRow?.mdd ?? null,
      sharpe,
      alpha,
    },
    monthly,
    equityCurve,
    perPick,
    best,
    worst,
    periods: BACKTEST_PERIODS,
  }
}
