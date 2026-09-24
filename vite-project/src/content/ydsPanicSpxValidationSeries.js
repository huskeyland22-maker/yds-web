/**
 * Panic × SPX 장기 검증 — 정적 시계열 + 저장 직후 live history upsert 병합
 */

import { getPanicScoreV2 } from "../utils/tradingScores.js"

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

function toFinitePanic(v) {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** @param {Record<string, unknown>} row */
export function resolvePanicScoreFromHistoryRow(row) {
  if (!row || typeof row !== "object") return null
  const stored = toFinitePanic(
    row.panic_v2 ?? row.panicV2 ?? row.panicV2Score ?? row.panic_index_v2 ?? row.panic,
  )
  if (stored != null) return Math.round(stored)
  return getPanicScoreV2(row)
}

/**
 * 저장 직후 live panic_index_history(cycleMetricHistory)를 검증 시계열에 upsert.
 * 같은 날짜 → panic 갱신, 새 날짜 → append (SPX는 직전 값 carry).
 * @param {PanicSpxValidationSeries | null | undefined} series
 * @param {object[] | null | undefined} historyRows
 * @returns {PanicSpxValidationSeries | null | undefined}
 */
export function mergeLiveHistoryIntoPanicSpxSeries(series, historyRows) {
  if (!series || !Array.isArray(series.rows) || !series.rows.length) return series
  if (!Array.isArray(historyRows) || historyRows.length === 0) return series

  /** @type {Map<string, PanicSpxValidationRow>} */
  const byDate = new Map()
  for (const r of series.rows) {
    const date = String(r?.date ?? "").slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    byDate.set(date, { date, spx: r.spx, panic: r.panic ?? null })
  }

  let touched = false
  let lastSpx = series.rows[series.rows.length - 1]?.spx ?? null
  for (const hr of historyRows) {
    const date = String(hr?.date ?? hr?.ts ?? "").slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const panic = resolvePanicScoreFromHistoryRow(hr)
    if (panic == null) continue
    const prev = byDate.get(date)
    if (prev) {
      if (prev.panic !== panic) touched = true
      byDate.set(date, { ...prev, panic })
      if (prev.spx != null && Number.isFinite(Number(prev.spx))) lastSpx = Number(prev.spx)
    } else {
      touched = true
      byDate.set(date, {
        date,
        spx: lastSpx != null && Number.isFinite(Number(lastSpx)) ? Number(lastSpx) : null,
        panic,
      })
    }
  }
  if (!touched) return series

  const rows = [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const spanStart = rows[0]?.date ?? series.span?.[0]
  const spanEnd = rows[rows.length - 1]?.date ?? series.span?.[1]
  return {
    ...series,
    span: [spanStart, spanEnd],
    rows,
  }
}

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

/** @param {string} date */
export function formatPanicTimingMd(date) {
  if (!date || date.length < 10) return "—"
  return `${date.slice(5, 7)}-${date.slice(8, 10)}`
}

/**
 * @param {number | null | undefined} n
 * @param {number} [digits]
 */
export function formatPanicTimingPct(n, digits = 1) {
  if (n == null || !Number.isFinite(Number(n))) return "미도달"
  const v = Number(n)
  const body = Math.abs(v).toFixed(digits)
  if (v > 0) return `+${body}%`
  if (v < 0) return `-${body}%`
  return `${(0).toFixed(digits)}%`
}

/**
 * D-20~D0 구간에서 threshold 최초 도달일
 * @param {PanicSpxValidationRow[]} windowRows
 * @param {number} thr
 * @returns {{ date: string; spx: number; panic: number } | null}
 */
export function firstPanicReachInWindow(windowRows, thr) {
  for (const row of windowRows) {
    if (row?.panic != null && Number.isFinite(row.panic) && row.panic >= thr && row.spx > 0) {
      return { date: row.date, spx: row.spx, panic: row.panic }
    }
  }
  return null
}

/**
 * @param {number} signalSpx
 * @param {number} d0Spx
 */
export function additionalDrawdownToBottom(signalSpx, d0Spx) {
  if (!Number.isFinite(signalSpx) || !Number.isFinite(d0Spx) || signalSpx === 0) return null
  return round1((d0Spx / signalSpx - 1) * 100)
}

function round1(n) {
  return Math.round(Number(n) * 10) / 10
}

function avgFinite(xs) {
  const vals = xs.filter((x) => x != null && Number.isFinite(x))
  if (!vals.length) return null
  return round1(vals.reduce((a, b) => a + b, 0) / vals.length)
}

/**
 * 저점별 매수 타이밍 검증표 (D-20~D0, 차트 rows만 사용)
 * @param {PanicSpxValidationSeries | null | undefined} series
 */
export function buildPanicEntryTimingTable(series) {
  if (!series?.rows?.length || !series?.bottoms?.length) return null

  const byDate = new Map(series.rows.map((r) => [r.date, r]))
  const dates = series.rows.map((r) => r.date)

  /** @type {Array<{
   *   d0: string
   *   d0Label: string
   *   ddPct: number | null
   *   ddLabel: string
   *   t50Date: string | null
   *   t50Label: string
   *   t50ToBottomPct: number | null
   *   t50ToBottomLabel: string
   *   t60Date: string | null
   *   t60Label: string
   *   t60ToBottomPct: number | null
   *   t60ToBottomLabel: string
   *   t70Date: string | null
   *   t70Label: string
   *   t70ToBottomPct: number | null
   *   t70ToBottomLabel: string
   * }>} */
  const rows = []

  for (const bottom of series.bottoms) {
    const d0 = bottom.d0
    const i0 = dates.indexOf(d0)
    if (i0 < 0) continue
    const d0Row = byDate.get(d0)
    const d0Spx = d0Row?.spx ?? bottom.spx
    const windowRows = series.rows.slice(Math.max(0, i0 - 20), i0 + 1)

    const r50 = firstPanicReachInWindow(windowRows, 50)
    const r60 = firstPanicReachInWindow(windowRows, 60)
    const r70 = firstPanicReachInWindow(windowRows, 70)

    const dd50 = r50 ? additionalDrawdownToBottom(r50.spx, d0Spx) : null
    const dd60 = r60 ? additionalDrawdownToBottom(r60.spx, d0Spx) : null
    const dd70 = r70 ? additionalDrawdownToBottom(r70.spx, d0Spx) : null

    rows.push({
      d0,
      d0Label: d0,
      ddPct: bottom.dd_pct ?? null,
      ddLabel: formatPanicTimingPct(bottom.dd_pct ?? null),
      t50Date: r50?.date ?? null,
      t50Label: r50 ? formatPanicTimingMd(r50.date) : "미도달",
      t50ToBottomPct: dd50,
      t50ToBottomLabel: r50 ? formatPanicTimingPct(dd50) : "미도달",
      t60Date: r60?.date ?? null,
      t60Label: r60 ? formatPanicTimingMd(r60.date) : "미도달",
      t60ToBottomPct: dd60,
      t60ToBottomLabel: r60 ? formatPanicTimingPct(dd60) : "미도달",
      t70Date: r70?.date ?? null,
      t70Label: r70 ? formatPanicTimingMd(r70.date) : "미도달",
      t70ToBottomPct: dd70,
      t70ToBottomLabel: r70 ? formatPanicTimingPct(dd70) : "미도달",
    })
  }

  const n = rows.length
  const hit50 = rows.filter((r) => r.t50Date).length
  const hit60 = rows.filter((r) => r.t60Date).length
  const hit70 = rows.filter((r) => r.t70Date).length

  return {
    rows,
    aggregates: {
      avgDropAfter50: avgFinite(rows.map((r) => r.t50ToBottomPct)),
      avgDropAfter60: avgFinite(rows.map((r) => r.t60ToBottomPct)),
      avgDropAfter70: avgFinite(rows.map((r) => r.t70ToBottomPct)),
      reach50: `${hit50}/${n}`,
      reach60: `${hit60}/${n}`,
      reach70: `${hit70}/${n}`,
      reach50Pct: n ? round1((100 * hit50) / n) : null,
      reach60Pct: n ? round1((100 * hit60) / n) : null,
      reach70Pct: n ? round1((100 * hit70) / n) : null,
    },
    disclaimer:
      "이 표는 과거 주요 저점에서 Panic 신호와 SPX 저점의 시간 관계를 확인하기 위한 참고 자료이며, 미래 수익을 보장하지 않습니다.",
  }
}
