/**
 * 성과검증 페이지 — 분석 패널 표시 여부 (n=0 · 데이터 부족 시 숨김)
 */

import { picksWithLockedOutcome } from "./ydsPickOutcomeEngine.js"

/** @typedef {import("./ydsValidationStorage.js").ValidationPickRecord} ValidationPickRecord */
/** @typedef {'d7' | 'd14' | 'd30'} PerfHorizonKey */

/**
 * @param {Array<Record<string, unknown>> | null | undefined} items
 * @param {string} [countKey]
 */
export function hasAnyPositiveCount(items, countKey = "count") {
  return (items ?? []).some((item) => {
    const n = Number(item[countKey])
    return Number.isFinite(n) && n > 0
  })
}

/**
 * @param {ValidationPickRecord[]} picks
 * @param {PerfHorizonKey} horizonKey
 */
export function countLockedHorizon(picks, horizonKey) {
  return picksWithLockedOutcome(picks ?? [], horizonKey).length
}

/**
 * @param {ValidationPickRecord[]} picks
 * @returns {Record<PerfHorizonKey, number>}
 */
export function buildHorizonAvailability(picks) {
  return {
    d7: countLockedHorizon(picks, "d7"),
    d14: countLockedHorizon(picks, "d14"),
    d30: countLockedHorizon(picks, "d30"),
  }
}

/**
 * @param {Record<PerfHorizonKey, number>} availability
 * @param {PerfHorizonKey} [preferred]
 * @returns {PerfHorizonKey}
 */
export function resolveDefaultHorizon(availability, preferred = "d7") {
  if ((availability[preferred] ?? 0) > 0) return preferred
  const order = /** @type {PerfHorizonKey[]} */ (["d7", "d14", "d30"])
  return order.find((k) => (availability[k] ?? 0) > 0) ?? "d7"
}

/** @param {import("./ydsPickOutcomeEngine.js").OutcomeSummaryReport} summary */
export function isOutcomePanelVisible(summary) {
  return (summary?.total ?? 0) > 0
}

/** @param {import("./ydsPickReliabilityAudit.js").ReliabilityAuditReport} report */
export function isReliabilityPanelVisible(report) {
  return (report?.totalWithD7 ?? 0) > 0
}

/** @param {import("./ydsPickScoreCorrelation.js").ScoreCorrelationReport} report */
export function isScoreCorrelationPanelVisible(report) {
  return (report?.total ?? 0) > 0 && hasAnyPositiveCount(report?.buckets)
}

/** @param {import("./ydsPickComponentContribution.js").ComponentContributionReport} report */
export function isComponentContributionPanelVisible(report) {
  if ((report?.total ?? 0) > 0 && (report?.ranking?.length ?? 0) > 0) return true
  return (report?.components ?? []).some((c) => hasAnyPositiveCount(c.grades))
}

/** @param {import("./ydsPickPanicDeepAnalysis.js").PanicDeepAnalysisReport} report */
export function isPanicDeepPanelVisible(report) {
  return hasAnyPositiveCount(report?.zones)
}

/** @param {import("./ydsPickMarketStateStrategy.js").MarketStateStrategyReport} report */
export function isMarketStrategyPanelVisible(report) {
  return hasAnyPositiveCount(report?.strategies)
}

/** @param {import("./ydsPickSuccessPatternEngine.js").SuccessPatternReport} pattern */
export function isSuccessPatternPanelVisible(pattern) {
  return (pattern?.totalTracked ?? 0) > 0
}

/** @param {import("./ydsPickPerfInsight.js").PerfInsightReport} report */
export function isPerfInsightPanelVisible(report) {
  return Boolean(report?.visible && (report.insights?.length ?? 0) > 0)
}

/** @param {import("./ydsPickTopSuccessReport.js").TopSuccessReport} report */
export function isTopSuccessReportPanelVisible(report) {
  return Boolean(report?.visible && (report.cases?.length ?? 0) > 0)
}

/**
 * @param {Record<PerfHorizonKey, number>} availability
 * @param {PerfHorizonKey} horizonKey
 */
export function isHorizonTabEnabled(availability, horizonKey) {
  return (availability[horizonKey] ?? 0) > 0
}
