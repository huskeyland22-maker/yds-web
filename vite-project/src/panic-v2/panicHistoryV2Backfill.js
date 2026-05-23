/**
 * cycleMetricHistory → panic_history_v2 백필 (localStorage)
 */
import { sortHistoryRowsAsc } from "../utils/panicHistoryDesk.js"
import { buildPanicV2DynamicSeries } from "./panicV2Dynamic.js"

export const PANIC_HISTORY_V2_STORAGE_KEY = "yds-panic-history-v2"

/**
 * @typedef {{
 *   version: 2
 *   builtAt: string
 *   rowCount: number
 *   series: { date: string; score: number; status?: string | null; statusId?: string | null }[]
 * }} PanicHistoryV2Store
 */

/** @param {ReturnType<typeof buildPanicV2DynamicSeries>} series @param {number} tradingDaysBack */
function computeWindowChangePct(series, tradingDaysBack) {
  const valid = series.filter((p) => p.score != null && Number.isFinite(p.score))
  if (valid.length < 2) return null
  const current = valid[valid.length - 1].score
  const idx = valid.length - 1 - tradingDaysBack
  if (idx < 0) return null
  const base = valid[idx].score
  if (!Number.isFinite(base) || base === 0) return null
  return ((current - base) / Math.abs(base)) * 100
}

/**
 * @param {ReturnType<typeof buildPanicV2DynamicSeries>} series
 * @param {object[]} [sourceRows]
 */
function persistPanicHistoryV2Meta(series, sourceRows = []) {
  const sixMonthPct = computeWindowChangePct(series, 126)
  const oneYearPct = computeWindowChangePct(series, 252)
  return {
    sourceRowCount: sourceRows.length,
    sixMonthPct,
    oneYearPct,
    rangeReady: {
      "6M": series.length >= 8,
      "1Y": series.length >= 252,
    },
  }
}

/** @param {ReturnType<typeof buildPanicV2DynamicSeries>} series @param {object[]} [sourceRows] */
export function persistPanicHistoryV2(series, sourceRows = []) {
  if (typeof window === "undefined") return
  const payload = {
    version: 2,
    builtAt: new Date().toISOString(),
    rowCount: series.length,
    windows: persistPanicHistoryV2Meta(series, sourceRows),
    series: series
      .filter((p) => p.score != null)
      .map((p) => ({
        date: p.date,
        score: p.score,
        status: p.status ?? null,
        statusId: p.statusId ?? null,
      })),
  }
  try {
    window.localStorage.setItem(PANIC_HISTORY_V2_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // quota
  }
}

/** @returns {PanicHistoryV2Store | null} */
export function loadPanicHistoryV2() {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(PANIC_HISTORY_V2_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.series || !Array.isArray(parsed.series)) return null
    return parsed
  } catch {
    return null
  }
}

/** @param {object[]} rows */
export function enrichCycleRowsWithPanicV2(rows) {
  if (!Array.isArray(rows) || rows.length < 8) return rows ?? []

  const series = buildPanicV2DynamicSeries(rows)
  const byDate = new Map(
    series.filter((p) => p.score != null).map((p) => [p.date, p]),
  )

  const enriched = sortHistoryRowsAsc(rows).map((row) => {
    const date = String(row?.date ?? "").slice(0, 10)
    const hit = byDate.get(date)
    if (!hit) return row
    return {
      ...row,
      panicV2DynamicScore: hit.score,
      panicV2Score: hit.score,
      panicV2Status: hit.status,
      panicV2StatusId: hit.statusId,
    }
  })

  persistPanicHistoryV2(series, rows)
  return enriched
}

/** @param {object[]} rows — 이미 enrich된 rows */
export function panicV2ScoreFromRow(row, fallbackHistory = []) {
  const cached = row?.panicV2DynamicScore ?? row?.panicV2Score ?? row?.panic_v2_score
  if (cached != null && Number.isFinite(Number(cached))) return Math.round(Number(cached))

  if (fallbackHistory.length >= 8) {
    const series = buildPanicV2DynamicSeries(fallbackHistory)
    const date = String(row?.date ?? "").slice(0, 10)
    const hit = series.find((p) => p.date === date)
    if (hit?.score != null) return hit.score
    return series.filter((p) => p.score != null).at(-1)?.score ?? null
  }
  return null
}
