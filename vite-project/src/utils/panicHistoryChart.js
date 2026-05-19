/**
 * 패닉 히스토리 차트 — 탭 → row 필드 매핑
 */

import { formatChartAxisMd } from "./chartDateFormat.js"
import { HISTORY_SECTION_METRICS } from "./panicDeskMetrics.js"
import { sortHistoryRowsAsc } from "./panicHistoryDesk.js"

/** UI 탭 id → cycle row 필드 */
export const HISTORY_CHART_FIELD_MAP = {
  vix: "vix",
  fearGreed: "fearGreed",
  bofa: "bofa",
  putCall: "putCall",
  highYield: "highYield",
  move: "move",
  skew: "skew",
  gs: "gsBullBear",
  gsBullBear: "gsBullBear",
}

export const HISTORY_MULTI_LINE_KEYS = [
  "vix",
  "fearGreed",
  "bofa",
  "putCall",
  "highYield",
  "move",
  "skew",
  "gsBullBear",
]

/** @param {object} row @param {string} field */
export function historyRowFieldValue(row, field) {
  if (!row || !field) return null
  if (field === "highYield") {
    const n = Number(row.highYield ?? row.hyOas)
    return Number.isFinite(n) ? n : null
  }
  if (field === "gsBullBear") {
    const n = Number(row.gsBullBear ?? row.gsSentiment)
    return Number.isFinite(n) ? n : null
  }
  const n = Number(row[field])
  return Number.isFinite(n) ? n : null
}

/**
 * @param {object[]} history
 * @param {string} activeHistoryTab — metric key or "all"
 */
export function resolveHistoryChartField(activeHistoryTab) {
  if (activeHistoryTab === "all") return null
  return HISTORY_CHART_FIELD_MAP[activeHistoryTab] ?? activeHistoryTab
}

/**
 * 단일 지표 — Recharts dataKey="value"
 * @param {object[]} history
 * @param {string} selectedField
 */
export function buildSingleMetricChartData(history, selectedField) {
  if (!selectedField) return []
  return sortHistoryRowsAsc(history)
    .map((row) => {
      const date = String(row.date ?? row.ts ?? "").slice(0, 10)
      const value = historyRowFieldValue(row, selectedField)
      if (!Number.isFinite(value)) return null
      return {
        date,
        axisLabel: formatChartAxisMd(date),
        value,
        [selectedField]: value,
      }
    })
    .filter(Boolean)
}

/**
 * ALL 탭 — 8지표 멀티라인
 * @param {object[]} history
 */
export function buildMultiMetricChartData(history) {
  return sortHistoryRowsAsc(history)
    .map((row) => {
      const date = String(row.date ?? row.ts ?? "").slice(0, 10)
      const point = { date, axisLabel: formatChartAxisMd(date) }
      let hasAny = false
      for (const key of HISTORY_MULTI_LINE_KEYS) {
        const v = historyRowFieldValue(row, key)
        if (Number.isFinite(v)) {
          point[key] = v
          hasAny = true
        }
      }
      return hasAny ? point : null
    })
    .filter(Boolean)
}

/**
 * @param {object[]} history
 * @param {string} activeHistoryTab
 */
export function buildHistoryChartPayload(history, activeHistoryTab) {
  const isAll = activeHistoryTab === "all"
  const selectedField = resolveHistoryChartField(activeHistoryTab)
  const chartData = isAll
    ? buildMultiMetricChartData(history)
    : buildSingleMetricChartData(history, selectedField)

  const multiSeries = isAll
    ? HISTORY_SECTION_METRICS.map((m) => ({
        key: m.key,
        stroke: m.accent,
        label: m.chartLabel,
      }))
    : null

  return {
    isAll,
    selectedField,
    dataKey: isAll ? null : "value",
    chartData,
    multiSeries,
  }
}
