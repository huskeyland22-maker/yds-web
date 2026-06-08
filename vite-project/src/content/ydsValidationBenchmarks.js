/**
 * Phase 7 — 검증용 지수 벤치마크 (기록·비교 구조만, 신규 지표 없음)
 */

import { calcRecommendReturnPct } from "../trading-zone/tradingZoneRecommendationTrack.js"
import { getStockSnapshot } from "./stockPickSnapshotProvider.js"
import { todayDateKey } from "./ydsPortfolioTradesStorage.js"

/** @typedef {'SPY' | 'QQQ' | 'KOSPI' | 'KOSDAQ'} BenchmarkId */

/**
 * @typedef {{
 *   id: BenchmarkId
 *   label: string
 *   ticker: string
 *   country: 'US' | 'KR'
 * }} BenchmarkDef
 */

export const VALIDATION_BENCHMARKS = /** @type {BenchmarkDef[]} */ ([
  { id: "SPY", label: "SPY", ticker: "SPY", country: "US" },
  { id: "QQQ", label: "QQQ", ticker: "QQQ", country: "US" },
  { id: "KOSPI", label: "KOSPI", ticker: "069500", country: "KR" },
  { id: "KOSDAQ", label: "KOSDAQ", ticker: "229200", country: "KR" },
])

/**
 * @param {BenchmarkDef} def
 */
export function fetchBenchmarkPrice(def) {
  const snap = getStockSnapshot({
    ticker: def.ticker,
    country: def.country,
    status: "interest",
  })
  const price = Number(snap?.price ?? snap?.close)
  return Number.isFinite(price) && price > 0 ? price : null
}

/**
 * @returns {Record<BenchmarkId, number | null>}
 */
export function captureBenchmarkPrices() {
  /** @type {Record<string, number | null>} */
  const out = {}
  for (const def of VALIDATION_BENCHMARKS) {
    out[def.id] = fetchBenchmarkPrice(def)
  }
  return /** @type {Record<BenchmarkId, number | null>} */ (out)
}

/**
 * @param {string} dateA
 * @param {string} dateB
 */
export function daysBetween(dateA, dateB) {
  const a = Date.parse(String(dateA).slice(0, 10))
  const b = Date.parse(String(dateB).slice(0, 10))
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.max(0, Math.floor((b - a) / 86400000))
}

/**
 * @param {Record<string, Record<BenchmarkId, number | null>>} log
 * @param {BenchmarkId} id
 * @param {string} startDate
 * @param {string} endDate
 */
export function benchmarkReturnBetween(log, id, startDate, endDate) {
  const start = log[startDate]?.[id]
  const end = log[endDate]?.[id] ?? findLatestBenchmarkPrice(log, id, endDate)
  return calcRecommendReturnPct(start, end)
}

/**
 * @param {Record<string, Record<BenchmarkId, number | null>>} log
 * @param {BenchmarkId} id
 * @param {string} onOrBefore
 */
function findLatestBenchmarkPrice(log, id, onOrBefore) {
  const dates = Object.keys(log)
    .filter((d) => d <= onOrBefore)
    .sort()
  for (let i = dates.length - 1; i >= 0; i -= 1) {
    const p = log[dates[i]]?.[id]
    if (p != null && Number.isFinite(p)) return p
  }
  return null
}

/**
 * @param {Record<string, Record<BenchmarkId, number | null>>} log
 * @param {string} endDate
 * @param {number} lookbackDays
 */
export function benchmarkReturnsForHorizon(log, endDate, lookbackDays) {
  const dates = Object.keys(log).sort()
  if (!dates.length) return /** @type {Record<BenchmarkId, number | null>} */ ({})

  const end = endDate || dates[dates.length - 1]
  const targetMs = Date.parse(end) - lookbackDays * 86400000
  const start =
    dates.find((d) => Date.parse(d) >= targetMs) ??
    dates.find((d) => d <= end) ??
    dates[0]

  /** @type {Record<string, number | null>} */
  const out = {}
  for (const def of VALIDATION_BENCHMARKS) {
    out[def.id] = benchmarkReturnBetween(log, def.id, start, end)
  }
  return /** @type {Record<BenchmarkId, number | null>} */ (out)
}

/**
 * @param {Record<string, Record<BenchmarkId, number | null>>} log
 */
export function maybeAppendBenchmarkLog(log) {
  const today = todayDateKey()
  if (log[today]) return log
  return { ...log, [today]: captureBenchmarkPrices() }
}
