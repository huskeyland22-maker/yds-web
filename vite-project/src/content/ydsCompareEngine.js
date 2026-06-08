/**
 * YDS Phase 4-4 — YDS vs 실제 비교 엔진 (구조·UI용)
 * 확정 통계는 수익률 기록 MIN_COMPARE_SAMPLES 건 이상부터
 */

import { filterEntriesByPeriod } from "./ydsComplianceEngine.js"

/** @typedef {import("./ydsActionLogStorage.js").YdsActionLogEntry} YdsActionLogEntry */

export const MIN_COMPARE_SAMPLES = 30
export const HIGH_COMPLIANCE_THRESHOLD = 80
export const LOW_COMPLIANCE_THRESHOLD = 50

/**
 * @typedef {{
 *   id: string
 *   date: string
 *   compliancePct: number
 *   actualReturnPct: number | null
 *   expectedReturnPct: number | null
 *   expectedStatus: 'pending' | 'future'
 *   actualStatus: 'recorded' | 'missing'
 * }} CompareRow
 */

/**
 * @typedef {{
 *   label: string
 *   count: number
 *   avgReturnPct: number | null
 *   enabled: boolean
 * }} CompareBucket
 */

/**
 * @typedef {{
 *   highCompliance: CompareBucket
 *   lowCompliance: CompareBucket
 * }} CompareFutureStats
 */

/**
 * @typedef {{
 *   totalEntries: number
 *   returnEntryCount: number
 *   statsReady: boolean
 *   minSamples: number
 *   statusMessage: string
 *   rows: CompareRow[]
 *   scatterPoints: { compliancePct: number; returnPct: number; date: string }[]
 *   futureStats: CompareFutureStats | null
 * }} CompareView
 */

/** @param {YdsActionLogEntry[]} entries */
export function entriesWithReturns(entries) {
  return entries.filter((e) => e.returnPct != null && Number.isFinite(e.returnPct))
}

/** @param {number[]} values */
function average(values) {
  if (!values.length) return null
  const sum = values.reduce((a, b) => a + b, 0)
  return Math.round((sum / values.length) * 10) / 10
}

/**
 * @param {YdsActionLogEntry[]} entries
 * @returns {CompareFutureStats | null}
 */
export function computeCompareFutureStats(entries) {
  const withReturns = entriesWithReturns(entries)
  if (withReturns.length < MIN_COMPARE_SAMPLES) return null

  const high = withReturns.filter((e) => e.compliancePct >= HIGH_COMPLIANCE_THRESHOLD)
  const low = withReturns.filter((e) => e.compliancePct <= LOW_COMPLIANCE_THRESHOLD)

  return {
    highCompliance: {
      label: `준수율 ${HIGH_COMPLIANCE_THRESHOLD}% 이상`,
      count: high.length,
      avgReturnPct: average(high.map((e) => e.returnPct)),
      enabled: high.length > 0,
    },
    lowCompliance: {
      label: `준수율 ${LOW_COMPLIANCE_THRESHOLD}% 이하`,
      count: low.length,
      avgReturnPct: average(low.map((e) => e.returnPct)),
      enabled: low.length > 0,
    },
  }
}

/**
 * @param {YdsActionLogEntry} entry
 * @returns {CompareRow}
 */
export function buildCompareRow(entry) {
  return {
    id: entry.id,
    date: entry.date,
    compliancePct: entry.compliancePct,
    actualReturnPct: entry.returnPct,
    expectedReturnPct: null,
    expectedStatus: "future",
    actualStatus: entry.returnPct != null ? "recorded" : "missing",
  }
}

/**
 * @param {YdsActionLogEntry[]} entries
 * @returns {CompareView}
 */
export function buildCompareView(entries) {
  const withReturns = entriesWithReturns(entries)
  const statsReady = withReturns.length >= MIN_COMPARE_SAMPLES
  const sorted = [...entries].sort((a, b) => {
    const da = Date.parse(a.date) || a.createdAt
    const db = Date.parse(b.date) || b.createdAt
    return db - da
  })

  const rows = sorted.map(buildCompareRow)
  const scatterPoints = withReturns.map((e) => ({
    compliancePct: e.compliancePct,
    returnPct: e.returnPct,
    date: e.date,
  }))

  const remaining = MIN_COMPARE_SAMPLES - withReturns.length
  const statusMessage = statsReady
    ? "수익률 기록이 충분합니다 · 아래 통계는 참고용이며 YDS는 예측을 주장하지 않습니다"
    : remaining > 0
      ? `비교 통계는 수익률 기록 ${MIN_COMPARE_SAMPLES}건 이상부터 활성화됩니다 (현재 ${withReturns.length}건 · ${remaining}건 더 필요)`
      : `비교 통계 준비 중 (현재 ${withReturns.length}건)`

  return {
    totalEntries: entries.length,
    returnEntryCount: withReturns.length,
    statsReady,
    minSamples: MIN_COMPARE_SAMPLES,
    statusMessage,
    rows,
    scatterPoints,
    futureStats: statsReady ? computeCompareFutureStats(entries) : null,
  }
}

/**
 * @param {YdsActionLogEntry[]} entries
 * @param {'30' | '90' | 'all'} period
 */
export function buildPeriodCompareSummary(entries, period = "all") {
  const filtered = filterEntriesByPeriod(entries, period)
  const view = buildCompareView(filtered)
  const withReturns = entriesWithReturns(filtered)

  return {
    period,
    entryCount: filtered.length,
    returnEntryCount: withReturns.length,
    avgCompliance:
      filtered.length > 0
        ? Math.round(filtered.reduce((s, e) => s + e.compliancePct, 0) / filtered.length)
        : null,
    avgReturnPct: average(withReturns.map((e) => e.returnPct)),
    statsReady: view.statsReady,
  }
}
