/**
 * Panic × SPX 장기 검증 — 시장 소스 재계산 V2 시계열 (YDS History DB 비사용)
 */

export const PANIC_SPX_VALIDATION_SERIES_URL = "/data/panic-spx-validation-series.json"

/** @type {readonly string[]} */
export const PANIC_SPX_VALIDATION_BOTTOMS = Object.freeze([
  "2023-03-13",
  "2023-10-03",
  "2023-10-27",
  "2024-04-19",
  "2024-08-05",
  "2025-03-13",
  "2025-04-08",
  "2025-11-20",
  "2026-03-30",
])

/**
 * @typedef {{
 *   date: string
 *   spx: number
 *   panic: number | null
 * }} PanicSpxValidationRow
 *
 * @typedef {{
 *   d0: string
 *   spx: number
 *   dd_pct: number
 *   peak_date: string
 *   panic_at_d0: number | null
 *   panic_peak: number | null
 *   panic_peak_date: string | null
 *   panic_peak_lag_td: number | null
 *   first50: { date: string; panic: number; spx: number } | null
 *   first60: { date: string; panic: number; spx: number } | null
 *   first70: { date: string; panic: number; spx: number } | null
 *   hit50: boolean
 *   hit60: boolean
 *   hit70: boolean
 * }} PanicSpxValidationBottom
 *
 * @typedef {{
 *   generatedAt: string
 *   sourceNote: string
 *   span: [string, string]
 *   missingPanicDates: string[]
 *   summary: {
 *     n: number
 *     hit50: number
 *     hit60: number
 *     hit70: number
 *     avg_panic_peak: number
 *     avg_peak_lag_td: number
 *   }
 *   bottoms: PanicSpxValidationBottom[]
 *   rows: PanicSpxValidationRow[]
 * }} PanicSpxValidationSeries
 */

/**
 * @param {PanicSpxValidationSeries | null | undefined} series
 * @param {string} d0
 * @param {number} [before]
 * @param {number} [after]
 * @returns {[string, string] | null}
 */
export function resolveBottomWindowDomain(series, d0, before = 20, after = 5) {
  if (!series?.rows?.length || !d0) return null
  const idx = series.rows.findIndex((r) => r.date === d0)
  if (idx < 0) return null
  const lo = series.rows[Math.max(0, idx - before)]?.date
  const hi = series.rows[Math.min(series.rows.length - 1, idx + after)]?.date
  if (!lo || !hi) return null
  return [lo, hi]
}

/**
 * @param {PanicSpxValidationSeries | null | undefined} series
 */
export function formatPanicSpxValidationSummary(series) {
  if (!series?.summary) return null
  const s = series.summary
  return {
    headline: `주요 저점 ${s.n}건 기준`,
    lines: [
      `Panic ≥50: ${s.hit50}/${s.n}`,
      `Panic ≥60: ${s.hit60}/${s.n}`,
      `Panic ≥70: ${s.hit70}/${s.n}`,
      `평균 Panic peak: ${s.avg_panic_peak}`,
      `평균 peak lag: ${s.avg_peak_lag_td} 거래일`,
    ],
    note: "50은 넓은 1차 진입 신호, 60/70은 희소한 추가 진입 신호로 확인됨.",
    sourceNote: series.sourceNote,
    missingPanicDates: series.missingPanicDates ?? [],
    span: series.span,
  }
}
