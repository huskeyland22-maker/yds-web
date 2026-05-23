/**
 * panic_index_history 구간 통계 (현재·고저·백분위·상태)
 */
import { formatMetricValue } from "../components/macroCycleChartUtils.js"
import { interpretPanicMetric } from "./panicMetricInterpretation.js"
import { panicV1ScoreForRow } from "../panic-v2/panicV1History.js"
import { buildPanicV2DynamicSeries } from "../panic-v2/panicV2Dynamic.js"
import { panicV2ScoreForRow } from "../panic-v2/panicV2History.js"
import { resolvePanicV2Status } from "../panic-v2/panicV2Status.js"
import { sortHistoryRowsAsc } from "./panicHistoryDesk.js"

/** @param {object} row @param {string} key */
function rowValue(row, key) {
  if (key === "panicV1") {
    const v = panicV1ScoreForRow(row)
    return Number.isFinite(v) ? v : null
  }
  if (key === "panicV2") {
    const v = panicV2ScoreForRow(row)
    return Number.isFinite(v) ? v : null
  }
  if (key === "highYield" || key === "hyOas") return Number(row.highYield ?? row.hyOas)
  if (key === "gsBullBear") return Number(row.gsBullBear ?? row.gsSentiment)
  return Number(row[key])
}

/** @param {object[]} rows @param {string} metricKey */
export function historyValuesForMetric(rows, metricKey) {
  if (metricKey === "panicV2") {
    return buildPanicV2DynamicSeries(rows)
      .map((p) => p.score)
      .filter((v) => v != null && Number.isFinite(v))
  }
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
  const lowRank = Math.round(100 - pct)
  if (!higherIsBad) {
    return `하위 ${Math.round(pct)}%`
  }
  return `하위 ${lowRank}%`
}

export const HIGHER_IS_BAD = {
  panicV2: true,
  panicV1: true,
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
 * @param {number | null} pct
 * @param {number} rowCount
 * @param {number} sessionsBack
 */
function buildChangeField(pct, rowCount, sessionsBack) {
  if (pct != null && Number.isFinite(pct)) {
    return { pct, text: formatHistoryChangePct(pct), pending: false }
  }
  if (rowCount < 1) {
    return { pct: null, text: "수집중", pending: true }
  }
  if (rowCount <= sessionsBack) {
    return { pct: null, text: "—", pending: false }
  }
  return { pct: null, text: "—", pending: false }
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
  const sorted = sortHistoryRowsAsc(rows)
  const rowCount = sorted.length
  const values = historyValuesForMetric(rows, metricKey)

  const emptyPending = {
    dayPct: null,
    dayText: "수집중",
    dayPending: true,
    weekPct: null,
    weekText: "수집중",
    weekPending: true,
    monthPct: null,
    monthText: "수집중",
    monthPending: true,
  }

  if (!values.length) return emptyPending

  const current = values[values.length - 1]
  const prevDay = metricValueSessionsAgo(rows, metricKey, 1)
  const prevWeek = metricValueSessionsAgo(rows, metricKey, 5)
  const prevMonth = metricValueSessionsAgo(rows, metricKey, 21)

  const day = buildChangeField(percentChangeFrom(current, prevDay), rowCount, 1)
  const week = buildChangeField(percentChangeFrom(current, prevWeek), rowCount, 5)
  const month = buildChangeField(percentChangeFrom(current, prevMonth), rowCount, 21)

  return {
    dayPct: day.pct,
    dayText: day.text,
    dayPending: day.pending,
    weekPct: week.pct,
    weekText: week.text,
    weekPending: week.pending,
    monthPct: month.pct,
    monthText: month.text,
    monthPending: month.pending,
  }
}

/** @param {number | null} pct @param {boolean} higherIsBad @param {boolean} [pending] */
export function historyChangeToneClass(pct, higherIsBad = true, pending = false) {
  if (pending) return "text-[10px] font-semibold text-slate-500"
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
    dayText: "수집중",
    dayPending: true,
    weekPct: null,
    weekText: "수집중",
    weekPending: true,
    monthPct: null,
    monthText: "수집중",
    monthPending: true,
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
  let statusLabel = "—"
  if (metricKey === "panicV2" || metricKey === "panicV1") {
    statusLabel = resolvePanicV2Status(current)?.label ?? "—"
  } else {
    const ins = interpretPanicMetric(metricKey, current)
    statusLabel = ins?.statusLabel ?? "—"
  }

  const changes = computeHistoryChangeRates(rows, metricKey)

  return {
    current,
    currentText:
      metricKey === "panicV2" || metricKey === "panicV1"
        ? String(Math.round(current))
        : formatMetricValue(metricKey, current),
    low,
    lowText: formatMetricValue(metricKey, low),
    high,
    highText: formatMetricValue(metricKey, high),
    percentileLabel: percentileUpperLabel(values, current, HIGHER_IS_BAD[metricKey] ?? true),
    statusLabel,
    ...changes,
  }
}
