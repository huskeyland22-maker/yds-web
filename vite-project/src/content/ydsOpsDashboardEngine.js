/**
 * YDS Phase 5-1 — 운영 대시보드 엔진
 * 기존 데이터 집계만 · 신규 신호 생성 없음
 */

import { computePeriodCompliance } from "./ydsComplianceEngine.js"
import { computeReturnStats } from "./ydsReturnEngine.js"
import { buildCompareView } from "./ydsCompareEngine.js"

/** @typedef {import("./ydsMarketAdapter.js").YdsMarketAdapterContext} YdsMarketAdapterContext */
/** @typedef {import("./ydsActionLogStorage.js").YdsActionLogEntry} YdsActionLogEntry */
/** @typedef {import("./ydsPortfolioAllocationEngine.js").AssetAllocation} AssetAllocation */

/**
 * @param {YdsMarketAdapterContext} context
 * @param {YdsActionLogEntry[]} entries
 * @param {AssetAllocation} recommended
 */
export function buildOpsDashboard(context, entries, recommended) {
  const sorted = [...entries].sort((a, b) => {
    const da = Date.parse(a.date) || a.createdAt
    const db = Date.parse(b.date) || b.createdAt
    return db - da
  })

  const recentLogs = sorted.slice(0, 5)
  const compareView = buildCompareView(entries)

  const compliance = {
    d30: computePeriodCompliance(entries, "30"),
    d90: computePeriodCompliance(entries, "90"),
    all: computePeriodCompliance(entries, "all"),
  }

  const returns = {
    d30: computeReturnStats(entries, "30"),
    d90: computeReturnStats(entries, "90"),
    d180: computeReturnStats(entries, "180"),
  }

  const summaryCompliance =
    compliance.d30.overallCompliance ?? compliance.all.overallCompliance
  const summaryReturn = returns.d90.avgReturnPct ?? returns.d30.avgReturnPct

  return {
    market: {
      ready: context.ready,
      panicLabel: context.panicLabel,
      panicEmoji: context.macroEmoji,
      strategyLabel: context.strategyLabel,
      strategyEmoji: context.strategyEmoji,
      cycleLabel: context.cycleLabel,
      cycleEmoji: context.cycleEmoji,
      marketLabel: context.marketLabel,
      marketEmoji: context.marketEmoji,
      ydsScore: context.ydsScore,
    },
    recommended,
    recentLogs,
    compliance,
    returns,
    compare: {
      statsReady: compareView.statsReady,
      returnEntryCount: compareView.returnEntryCount,
      minSamples: compareView.minSamples,
    },
    summary: {
      strategyLabel: context.strategyLabel,
      strategyEmoji: context.strategyEmoji,
      compliancePct: summaryCompliance,
      avgReturnPct: summaryReturn,
      logCount: entries.length,
    },
  }
}
