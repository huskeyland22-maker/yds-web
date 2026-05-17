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

const HIGHER_IS_BAD = {
  vix: true,
  putCall: true,
  highYield: true,
  move: true,
  skew: true,
  fearGreed: false,
  bofa: false,
  gsBullBear: false,
}

/**
 * @param {object[]} rows
 * @param {string} metricKey
 */
export function computeHistoryMetricStats(rows, metricKey) {
  const values = historyValuesForMetric(rows, metricKey)
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
    }
  }

  const current = values[values.length - 1]
  const low = Math.min(...values)
  const high = Math.max(...values)
  const ins = interpretPanicMetric(metricKey, current)
  const statusLabel = ins?.statusLabel ?? "—"

  return {
    current,
    currentText: formatMetricValue(metricKey, current),
    low,
    lowText: formatMetricValue(metricKey, low),
    high,
    highText: formatMetricValue(metricKey, high),
    percentileLabel: percentileUpperLabel(values, current, HIGHER_IS_BAD[metricKey] ?? true),
    statusLabel,
  }
}
