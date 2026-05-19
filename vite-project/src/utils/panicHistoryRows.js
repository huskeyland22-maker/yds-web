/**
 * cycleMetricHistory · panic_index_history 공통 row 해석
 */

import { PANIC_INDEX_HISTORY_KEY, panicIndexRowToCycleChart } from "./panicIndexHistory.js"
import { HISTORY_SECTION_METRICS } from "./panicDeskMetrics.js"

function rowValue(row, key) {
  if (!row) return null
  if (key === "highYield" || key === "hyOas") return Number(row.highYield ?? row.hyOas)
  if (key === "gsBullBear") return Number(row.gsBullBear ?? row.gsSentiment)
  if (key === "panicScore") return Number(row.panicScore ?? row.panic_score)
  return Number(row[key])
}

/** @param {object[]} rows */
export function historyHasAnyMetric(rows) {
  if (!Array.isArray(rows) || !rows.length) return false
  return HISTORY_SECTION_METRICS.some((m) => rows.some((r) => Number.isFinite(rowValue(r, m.key))))
}

/**
 * @param {object[]} rows
 * @param {string} [preferred]
 */
export function resolveDefaultHistoryMetric(rows, preferred = "vix") {
  const order = ["panicScore", "vix", ...HISTORY_SECTION_METRICS.map((m) => m.key)]
  const seen = new Set()
  for (const key of [preferred, ...order]) {
    if (!key || seen.has(key)) continue
    seen.add(key)
    if (rows.some((r) => Number.isFinite(rowValue(r, key)))) return key
  }
  return preferred
}

/** @param {object[]} rows @param {string} metricKey */
export function filterHistoryRowsForMetric(rows, metricKey) {
  if (!Array.isArray(rows) || !metricKey) return []
  return rows.filter((r) => Number.isFinite(rowValue(r, metricKey)))
}

/**
 * props rows + localStorage fallback
 * @param {object[] | undefined} rows
 */
export function resolveCycleHistoryRows(rows) {
  const fromProp = Array.isArray(rows) ? rows.filter((r) => r && r.date) : []
  if (fromProp.length) return fromProp

  if (typeof window === "undefined") return []
  try {
    const raw = JSON.parse(window.localStorage.getItem(PANIC_INDEX_HISTORY_KEY) || "[]")
    const arr = Array.isArray(raw) ? raw : []
    return arr.map((r) => panicIndexRowToCycleChart(r)).filter(Boolean)
  } catch {
    return []
  }
}
