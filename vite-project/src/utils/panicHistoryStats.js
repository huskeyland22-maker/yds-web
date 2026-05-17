/**
 * panic_index_history 구간 통계 (현재·고저·백분위·상태)
 */
import { formatMetricValue } from "../components/macroCycleChartUtils.js"
import { interpretPanicMetric } from "./panicMetricInterpretation.js"
import { sortHistoryRowsAsc } from "./panicHistoryDesk.js"

/** @param {object} row @param {string} key */
function rowValue(row, key) {
  if (key === "highYield" || key === "hyOas") return Number(row.highYield ?? row.hyOas)
  if (key === "gsBullBear") return Number(row.gsBullBear ?? row.gsSentiment)
  return Number(row[key])
}

/** @param {object[]} rows @param {string} metricKey */
export function historyValuesForMetric(rows, metricKey) {
  return sortHistoryRowsAsc(rows)
    .map((r) => rowValue(r, metricKey))
    .filter(Number.isFinite)
}

/**
 * @param {number[]} values
 * @param {number} current
 * @param {boolean} higherIsBad
 */
function percentileUpperLabel(values, current, higherIsBad = true) {
  if (!values.length || !Number.isFinite(current)) return "—"
  const below = values.filter((v) => v < current).length
  const pct = (below / values.length) * 100
  const upper = Math.round(100 - pct)
  if (!higherIsBad) {
    return `하위 ${Math.round(pct)}%`
  }
  return `상위 ${upper}%`
}

export const HIGHER_IS_BAD = {
  vix: true,
  vxn: true,
  putCall: true,
  highYield: true,
  hyOas: true,
  move: true,
  skew: true,
  fearGreed: false,
  bofa: false,
  gsBullBear: false,
}

/** @param {number | null} pct */
export function formatHistoryChangePct(pct) {
  if (pct == null || !Number.isFinite(pct)) return "—"
  const sign = pct >= 0 ? "+" : ""
  return `${sign}${pct.toFixed(1)}%`
}

/**
 * @param {number} current
 * @param {number | null} base
 */
function percentChangeFrom(current, base) {
  if (!Number.isFinite(current) || base == null || !Number.isFinite(base) || base === 0) {
    return null
  }
  return ((current - base) / Math.abs(base)) * 100
}

/**
 * @param {object[]} rows
 * @param {string} metricKey
 * @param {number} sessionsBack
 */
function metricValueSessionsAgo(rows, metricKey, sessionsBack) {
  const sorted = sortHistoryRowsAsc(rows)
  const idx = sorted.length - 1 - sessionsBack
  if (idx < 0) return null
  const v = rowValue(sorted[idx], metricKey)
  return Number.isFinite(v) ? v : null
}

/**
 * @param {object[]} rows
 * @param {string} metricKey
 */
export function computeHistoryChangeRates(rows, metricKey) {
  const values = historyValuesForMetric(rows, metricKey)
  if (!values.length) {
    return {
      dayPct: null,
      dayText: "—",
      weekPct: null,
      weekText: "—",
      monthPct: null,
      monthText: "—",
    }
  }
  const current = values[values.length - 1]
  const prevDay = metricValueSessionsAgo(rows, metricKey, 1)
  const prevWeek = metricValueSessionsAgo(rows, metricKey, 5)
  const prevMonth = metricValueSessionsAgo(rows, metricKey, 21)

  const dayPct = percentChangeFrom(current, prevDay)
  const weekPct = percentChangeFrom(current, prevWeek)
  const monthPct = percentChangeFrom(current, prevMonth)

  return {
    dayPct,
    dayText: formatHistoryChangePct(dayPct),
    weekPct,
    weekText: formatHistoryChangePct(weekPct),
    monthPct,
    monthText: formatHistoryChangePct(monthPct),
  }
}

/** @param {number | null} pct @param {boolean} higherIsBad */
export function historyChangeToneClass(pct, higherIsBad = true) {
  if (pct == null || !Number.isFinite(pct) || Math.abs(pct) < 0.05) return "text-slate-300"
  const up = pct > 0
  const favorable = higherIsBad ? !up : up
  return favorable ? "text-emerald-400" : "text-rose-400"
}

/**
 * @param {object[]} rows
 * @param {string} metricKey
 */
export function computeHistoryMetricStats(rows, metricKey) {
  const values = historyValuesForMetric(rows, metricKey)
  const emptyChanges = {
    dayPct: null,
    dayText: "—",
    weekPct: null,
    weekText: "—",
    monthPct: null,
    monthText: "—",
  }

  if (!values.length) {
    return {
      current: null,
      currentText: "—",
      low: null,
      lowText: "—",
      high: null,
      highText: "—",
      percentileLabel: "—",
      statusLabel: "—",
      ...emptyChanges,
    }
  }

  const current = values[values.length - 1]
  const low = Math.min(...values)
  const high = Math.max(...values)
  const ins = interpretPanicMetric(metricKey, current)
  const statusLabel = ins?.statusLabel ?? "—"

  const changes = computeHistoryChangeRates(rows, metricKey)

  return {
    current,
    currentText: formatMetricValue(metricKey, current),
    low,
    lowText: formatMetricValue(metricKey, low),
    high,
    highText: formatMetricValue(metricKey, high),
    percentileLabel: percentileUpperLabel(values, current, HIGHER_IS_BAD[metricKey] ?? true),
    statusLabel,
    ...changes,
  }
}
