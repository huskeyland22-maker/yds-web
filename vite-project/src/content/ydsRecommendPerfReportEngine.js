/**
 * 추천 성과 리포트 — 저장된 검증 데이터 기반 (전체 이력 · 7·14·30일)
 * GO #80: 종료·실패 포함 전체 추천 기준 신뢰 성과
 */

import {
  buildPickPerformanceReport,
  filterPicksInWindow,
  PERF_HORIZONS,
} from "./ydsPickPerformanceEngine.js"
import { loadValidationBenchmarkLog } from "./ydsValidationStorage.js"
import { calcRecommendReturnPct } from "../trading-zone/tradingZoneRecommendationTrack.js"
import { todayDateKey } from "./ydsPortfolioTradesStorage.js"
import { subtractCalendarDays } from "./ydsValidationEngine.js"
import {
  buildPickTrustPerfStats,
} from "./ydsPickLifecycleEngine.js"
import { buildRecommendPerfBriefing } from "./ydsRecommendPerfBriefingEngine.js"
import {
  buildHubHistoryViewRows,
  buildRecommendPerfSummaryCards,
} from "./ydsHubHistoryViewEngine.js"
import { logRecommendPerfPipelineTrace } from "./ydsRecommendPerfAudit.js"

/** windowDays <= 0 이면 전체 추천 이력 */
export const RECOMMEND_PERF_ALL_HISTORY_WINDOW = 0

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord[]} picks
 * @param {string} horizonKey
 */
function estimateAlpha(picks, horizonKey) {
  const horizonDays = PERF_HORIZONS.find((h) => h.key === horizonKey)?.days ?? 30
  const rows = (picks ?? []).filter((p) => {
    const ret = p.finalReturnPct ?? p.horizons?.[horizonKey] ?? p.returnPct
    return ret != null && Number.isFinite(ret)
  })
  if (!rows.length) return null

  const pickAvg =
    rows.reduce((s, p) => {
      const ret = p.finalReturnPct ?? p.horizons?.[horizonKey] ?? p.returnPct ?? 0
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
 * @param {number | null} [windowDays]
 * @param {import("./ydsStockPickModel.js").StockPickView[]} [stocks]
 */
export function buildRecommendPerfReport(
  allPicks,
  windowDays = RECOMMEND_PERF_ALL_HISTORY_WINDOW,
  stocks = [],
) {
  const today = todayDateKey()
  const picks = filterPicksInWindow(allPicks, windowDays)
  const base = buildPickPerformanceReport(allPicks, windowDays)
  const trustStats = buildPickTrustPerfStats(allPicks, windowDays)
  const alpha30 = estimateAlpha(picks, "d30")
  const trustWithAlpha = { ...trustStats, alpha: alpha30 ?? trustStats.alpha }
  const briefing = buildRecommendPerfBriefing(trustWithAlpha, windowDays)

  const horizons = PERF_HORIZONS.map((h) => {
    const alpha = estimateAlpha(picks, h.key)
    return {
      ...h,
      ...trustWithAlpha,
      alpha,
      winRate: trustStats.winRate,
      successRate: trustStats.winRate,
      maxGain: trustStats.maxGain,
      maxLoss: trustStats.maxLoss,
    }
  })

  const activeHorizon = horizons.find((h) => h.key === "d30") ?? horizons[2]
  const historyRows = buildHubHistoryViewRows(stocks)

  const recentPicks = historyRows.map((row) => {
    const daysHeld = row.daysSinceRecommend ?? 0
    return {
      ticker: row.ticker,
      name: row.name,
      recommendedAt: row.recommendedAtLabel,
      recommendedPrice: row.recommendedPriceLabel,
      currentPrice: row.currentPriceLabel,
      returnPct: row.returnPct,
      returnLabel: row.returnLabel,
      maxReturnLabel: row.returnLabel,
      maxLossLabel: row.returnLabel,
      daysHeldLabel: `${daysHeld}일`,
      elapsedLabel: row.elapsedLabel,
      lifecycleId: row.lifecycleId,
      resultBadge: row.resultBadge,
      successLabel: row.resultBadge,
      statusLabel: row.statusLabel,
      aiGradeLabel: row.aiGradeLabel,
      reasonLine: row.reasonLine,
    }
  })

  const todayCount = (allPicks ?? []).filter((p) => String(p.recommendedAt).slice(0, 10) === today)
    .length

  logRecommendPerfPipelineTrace({
    stage: "buildRecommendPerfReport",
    totalFromStorage: (allPicks ?? []).length,
    todayCount,
    windowDays,
    afterWindowFilter: picks.length,
    historyRowCount: historyRows.length,
    recentPicksCount: recentPicks.length,
  })

  return {
    title: "추천 성과 리포트",
    windowDays,
    scopeLabel:
      windowDays == null || windowDays <= 0 ? "전체 추천 이력" : `최근 ${windowDays}일`,
    horizons,
    kpi: activeHorizon,
    trustStats: trustWithAlpha,
    briefing,
    summaryCards: buildRecommendPerfSummaryCards(allPicks, stocks),
    recentPicks,
    pickCount: picks.length,
    totalPickCount: (allPicks ?? []).length,
    visible: (allPicks ?? []).length > 0,
    base,
  }
}
