import { metricDisplayLabel } from "./metricLabels.js"

/**
 * Bond / Liquidity Monitor 지표 메타 (FRED 연동 준비, 신규 API 없음).
 * LIVE 실제 수신은 /api/market-data 키 존재 여부로 판별.
 */

/** @typedef {'MANUAL'|'LIVE'|'MOCK'|'STATIC'} DataSourceBadge */

/** @typedef {Object} MetricCatalogEntry
 * @property {string} key
 * @property {string} short
 * @property {string} label
 * @property {number} tier
 * @property {string} provider
 * @property {string} series
 * @property {boolean} liveTarget
 * @property {boolean} cycleReuse
 */

/** @type {MetricCatalogEntry[]} */
export const TIER_STATUS_METRICS = [
  { key: "US10Y", short: "10Y", label: metricDisplayLabel("US10Y"), tier: 1, provider: "FRED", series: "DGS10", liveTarget: true, cycleReuse: false },
  { key: "US30Y", short: "30Y", label: metricDisplayLabel("US30Y"), tier: 1, provider: "FRED", series: "DGS30", liveTarget: true, cycleReuse: false },
  { key: "DXY", short: "DXY", label: metricDisplayLabel("DXY"), tier: 1, provider: "Yahoo", series: "DX-Y.NYB", liveTarget: true, cycleReuse: false },
  { key: "REAL_YIELD", short: "REAL", label: metricDisplayLabel("REAL_YIELD"), tier: 2, provider: "FRED", series: "DFII10", liveTarget: true, cycleReuse: false },
  { key: "US2Y", short: "2Y", label: metricDisplayLabel("US2Y"), tier: 2, provider: "FRED", series: "DGS2", liveTarget: true, cycleReuse: false },
  { key: "BEI", short: "BEI", label: metricDisplayLabel("BEI"), tier: 2, provider: "FRED", series: "T10YIE", liveTarget: true, cycleReuse: false },
]

/** @type {Record<string, MetricCatalogEntry>} */
export const METRIC_CATALOG_BY_KEY = Object.fromEntries(TIER_STATUS_METRICS.map((m) => [m.key, m]))

/**
 * @param {string} key
 * @returns {MetricCatalogEntry|undefined}
 */
export function getMetricCatalog(key) {
  return METRIC_CATALOG_BY_KEY[key]
}

/**
 * @param {string} rawSource
 * @param {import('./deltaSemantics.js').DataSourceBadge} badge
 * @param {boolean} liveFetchOk
 * @param {boolean} liveTarget
 * @returns {string|null}
 */
export function describeSourceFallback(rawSource, badge, liveFetchOk, liveTarget) {
  if (rawSource === "missing") return liveTarget ? "시계열 미로드" : "입력 없음"
  if (badge === "MANUAL") return "cycle reuse"
  if (badge === "LIVE") return null
  if (!liveTarget) {
    if (badge === "MOCK") return "mock seed"
    if (badge === "STATIC") return "static seed"
    return null
  }
  if (!liveFetchOk) return "LIVE 실패 → MOCK/STATIC fallback"
  if (badge === "MOCK") return "MOCK fallback"
  if (badge === "STATIC") return "STATIC fallback"
  return "MOCK fallback"
}

/** UI 배지 색상 (Tier / DEV / LIVE STATUS 공통) */
export const DATA_BADGE_CLASS = {
  MANUAL: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  LIVE: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  MOCK: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  STATIC: "border-slate-500/30 bg-slate-500/10 text-slate-400",
}
