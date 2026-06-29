/**
 * 추천 성과 리포트 — 저장된 검증 데이터 기반 (7·14·30일)
 * GO #80: 종료·실패 포함 전체 추천 기준 신뢰 성과
 */

import {
  buildPickPerformanceReport,
  filterPicksInWindow,
  formatPerfPct,
  PERF_HORIZONS,
} from "./ydsPickPerformanceEngine.js"
import { loadValidationBenchmarkLog } from "./ydsValidationStorage.js"
import { calcRecommendReturnPct } from "../trading-zone/tradingZoneRecommendationTrack.js"
import { todayDateKey } from "./ydsPortfolioTradesStorage.js"
import { subtractCalendarDays } from "./ydsValidationEngine.js"
import {
  buildPickTrustPerfStats,
  daysBetweenPickDates,
  resolvePickLifecycleView,
} from "./ydsPickLifecycleEngine.js"
import { formatTransparencyPrice } from "./ydsStockPickTransparency.js"

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord[]} picks
 * @param {string} horizonKey
 */
function estimateAlpha(picks, horizonKey) {
  const horizonDays = PERF_HORIZONS.find((h) => h.key === horizonKey)?.days ?? 30
  const rows = (picks ?? []).filter((p) => {
    const ret =
      p.finalReturnPct ??
      p.horizons?.[horizonKey] ??
      p.returnPct
    return ret != null && Number.isFinite(ret)
  })
  if (!rows.length) return null

  const pickAvg =
    rows.reduce((s, p) => {
      const ret =
        p.finalReturnPct ??
        p.horizons?.[horizonKey] ??
        p.returnPct ??
        0
      return s + Number(ret)
    }, 0) / rows.length

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
  const trustStats = buildPickTrustPerfStats(allPicks, windowDays)

  const horizons = PERF_HORIZONS.map((h) => {
    const alpha = estimateAlpha(picks, h.key)
    return {
      ...h,
      ...trustStats,
      alpha,
      winRate: trustStats.winRate,
      successRate: trustStats.winRate,
      maxGain: trustStats.maxGain,
      maxLoss: trustStats.maxLoss,
    }
  })

  const activeHorizon = horizons.find((h) => h.key === "d30") ?? horizons[2]
  const today = todayDateKey()

  const recentPicks = [...picks]
    .sort((a, b) => b.recommendedAt.localeCompare(a.recommendedAt))
    .slice(0, 20)
    .map((p) => {
      const country = p.country === "KR" ? "KR" : "US"
      const ret =
        p.finalReturnPct ??
        p.returnPct ??
        p.horizons?.d30 ??
        p.horizons?.d14 ??
        p.horizons?.d7 ??
        null
      let maxRet = ret
      let minRet = ret
      for (const v of Object.values(p.horizons ?? {})) {
        if (v != null && Number.isFinite(v)) {
          if (maxRet == null || v > maxRet) maxRet = v
          if (minRet == null || v < minRet) minRet = v
        }
      }
      const daysHeld = daysBetweenPickDates(p.recommendedAt, p.closedAt ?? today)
      const lifecycle = resolvePickLifecycleView(p.lifecycleId ?? "active")
      return {
        ticker: p.ticker,
        name: p.name,
        recommendedAt: p.recommendedAt,
        recommendedPrice: formatTransparencyPrice(p.recommendedPrice, country),
        currentPrice: formatTransparencyPrice(p.currentPrice, country),
        returnPct: ret,
        returnLabel: formatPerfPct(ret),
        maxReturnLabel: formatPerfPct(maxRet),
        maxLossLabel: formatPerfPct(minRet),
        daysHeldLabel: `${daysHeld}일`,
        lifecycleId: lifecycle.id,
        resultBadge: `${lifecycle.badgeEmoji} ${lifecycle.badgeLabel}`,
        successLabel: `${lifecycle.badgeEmoji} ${lifecycle.badgeLabel}`,
        statusLabel: `${lifecycle.emoji} ${lifecycle.label}`,
      }
    })

  return {
    title: "추천 성과 리포트",
    windowDays,
    horizons,
    kpi: activeHorizon,
    trustStats,
    recentPicks,
    pickCount: picks.length,
    visible: picks.length > 0 || (allPicks ?? []).length > 0,
  }
}
