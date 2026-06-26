/**
 * 추천 성과 리포트 — 저장된 검증 데이터 기반 (7·14·30일)
 */

import {
  buildPickPerformanceReport,
  filterPicksInWindow,
  formatPerfPct,
  PERF_HORIZONS,
  summarizeHorizonReturns,
} from "./ydsPickPerformanceEngine.js"
import { loadValidationBenchmarkLog } from "./ydsValidationStorage.js"
import { calcRecommendReturnPct } from "../trading-zone/tradingZoneRecommendationTrack.js"
import { todayDateKey } from "./ydsPortfolioTradesStorage.js"
import { subtractCalendarDays } from "./ydsValidationEngine.js"
import { classifyPickOutcome } from "./ydsPickOutcomeEngine.js"
import { formatTransparencyPrice } from "./ydsStockPickTransparency.js"

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord[]} picks
 * @param {string} horizonKey
 */
function computeExtendedStats(picks, horizonKey) {
  const rows = (picks ?? []).filter((p) => {
    const ret = p.horizons?.[horizonKey]
    return ret != null && Number.isFinite(ret)
  })
  if (!rows.length) {
    return {
      count: 0,
      successRate: null,
      avgReturn: null,
      avgLoss: null,
      profitFactor: null,
      avgHoldDays: null,
      alpha: null,
    }
  }

  const returns = rows.map((r) => Number(r.horizons[horizonKey]))
  const wins = returns.filter((v) => v > 0)
  const losses = returns.filter((v) => v < 0)
  const avgReturn = returns.reduce((s, v) => s + v, 0) / returns.length
  const avgWin = wins.length ? wins.reduce((s, v) => s + v, 0) / wins.length : 0
  const avgLoss = losses.length
    ? losses.reduce((s, v) => s + v, 0) / losses.length
    : null
  const profitFactor =
    avgLoss != null && avgLoss < 0 && avgWin > 0
      ? Math.round((avgWin / Math.abs(avgLoss)) * 100) / 100
      : null

  const today = todayDateKey()
  const avgHoldDays = Math.round(
    rows.reduce((s, r) => {
      const start = String(r.recommendedAt).slice(0, 10)
      const end = subtractCalendarDays(today, 0)
      const d0 = Date.parse(start)
      const d1 = Date.parse(end)
      const days = Number.isFinite(d0) && Number.isFinite(d1) ? Math.max(0, (d1 - d0) / 86400000) : 0
      return s + days
    }, 0) / rows.length,
  )

  const successCount = returns.filter((v) => classifyPickOutcome(v) === "success").length
  const successRate = Math.round((successCount / returns.length) * 1000) / 10

  return {
    count: rows.length,
    successRate,
    avgReturn: Math.round(avgReturn * 10) / 10,
    avgLoss: avgLoss != null ? Math.round(avgLoss * 10) / 10 : null,
    profitFactor,
    avgHoldDays,
    alpha: null,
  }
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord[]} picks
 * @param {string} horizonKey
 */
function estimateAlpha(picks, horizonKey) {
  const horizonDays = PERF_HORIZONS.find((h) => h.key === horizonKey)?.days ?? 30
  const rows = (picks ?? []).filter((p) => p.horizons?.[horizonKey] != null)
  if (!rows.length) return null

  const pickAvg =
    rows.reduce((s, p) => s + Number(p.horizons[horizonKey]), 0) / rows.length

  const benchLog = loadValidationBenchmarkLog()
  const dates = Object.keys(benchLog).sort()
  if (dates.length < 2) return null

  const endDate = dates[dates.length - 1]
  const startDate =
    dates.find((d) => d >= subtractCalendarDays(endDate, horizonDays)) ?? dates[0]
  const spyStart = benchLog[startDate]?.SPY
  const spyEnd = benchLog[endDate]?.SPY ?? benchLog[dates[dates.length - 1]]?.SPY
  const benchRet = calcRecommendReturnPct(spyStart, spyEnd)
  if (benchRet == null || !Number.isFinite(benchRet)) return null

  return Math.round((pickAvg - benchRet) * 10) / 10
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord[]} allPicks
 * @param {number} [windowDays]
 */
export function buildRecommendPerfReport(allPicks, windowDays = 30) {
  const base = buildPickPerformanceReport(allPicks, windowDays)
  const picks = filterPicksInWindow(allPicks, windowDays)

  const horizons = PERF_HORIZONS.map((h) => {
    const stats = computeExtendedStats(picks, h.key)
    const alpha = estimateAlpha(picks, h.key)
    return {
      ...h,
      ...stats,
      alpha,
      winRate: stats.successRate,
    }
  })

  const activeHorizon = horizons.find((h) => h.key === "d30") ?? horizons[2]

  const recentPicks = [...picks]
    .sort((a, b) => b.recommendedAt.localeCompare(a.recommendedAt))
    .slice(0, 12)
    .map((p) => {
      const country = p.country === "KR" ? "KR" : "US"
      const ret =
        p.returnPct ??
        p.horizons?.d30 ??
        p.horizons?.d14 ??
        p.horizons?.d7 ??
        null
      const outcome = classifyPickOutcome(ret)
      return {
        ticker: p.ticker,
        name: p.name,
        recommendedAt: p.recommendedAt,
        recommendedPrice: formatTransparencyPrice(p.recommendedPrice, country),
        currentPrice: formatTransparencyPrice(p.currentPrice, country),
        returnPct: ret,
        returnLabel: formatPerfPct(ret),
        success: outcome === "success",
        successLabel: outcome === "success" ? "성공" : outcome === "failure" ? "실패" : "보통",
      }
    })

  return {
    title: "추천 성과 리포트",
    windowDays,
    horizons,
    kpi: activeHorizon,
    recentPicks,
    pickCount: picks.length,
    visible: picks.length > 0 || (allPicks ?? []).length > 0,
  }
}
