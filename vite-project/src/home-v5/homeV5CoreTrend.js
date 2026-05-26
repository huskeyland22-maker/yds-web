import { getStatus } from "../utils/panicIndicatorStatus.js"
import { historyValuesForMetric } from "../utils/panicHistoryStats.js"
import { sortHistoryRowsAsc } from "../utils/panicHistoryDesk.js"

/** @typedef {"fearGreed" | "vix" | "highYield"} HomeV5CoreKey */
/** @typedef {"up" | "down" | "flat"} HomeV5TrendDir */

const CAPTIONS = {
  fearGreed: "CNN 공포탐욕",
  vix: "VIX",
  highYield: "HY 스프레드",
}

const FLAT_THRESHOLDS = {
  fearGreed: 2,
  vix: 0.5,
  highYield: 0.05,
}

/** @param {string} iso */
function subtractCalendarDays(iso, days) {
  const [y, mo, da] = iso.split("-").map((n) => Number(n))
  const d = new Date(y, mo - 1, da)
  d.setDate(d.getDate() - days)
  const yy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}

/** @param {object} row */
function rowDateKey(row) {
  return String(row?.date ?? row?.ts ?? "").slice(0, 10)
}

/** @param {object} row @param {HomeV5CoreKey} key */
function metricAtRow(row, key) {
  if (!row) return null
  if (key === "highYield") {
    const n = Number(row.highYield ?? row.hyOas)
    return Number.isFinite(n) ? n : null
  }
  const n = Number(row[key])
  return Number.isFinite(n) ? n : null
}

/**
 * @param {object[]} rows asc by date
 * @param {string} targetIso YYYY-MM-DD
 */
function valueOnOrBefore(rows, targetIso, key) {
  let picked = null
  for (const row of rows) {
    const dk = rowDateKey(row)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dk)) continue
    if (dk <= targetIso) picked = row
    else break
  }
  return picked ? metricAtRow(picked, key) : null
}

/** @param {number} delta @param {HomeV5CoreKey} key */
function classifyDirection(delta, key) {
  const t = FLAT_THRESHOLDS[key]
  if (!Number.isFinite(delta) || Math.abs(delta) < t) return "flat"
  return delta > 0 ? "up" : "down"
}

/** @param {HomeV5TrendDir} dir */
function trendArrow(dir) {
  if (dir === "up") return "↗"
  if (dir === "down") return "↘"
  return "→"
}

/** @param {number} delta @param {HomeV5CoreKey} key @param {number | null} current */
function trendDetail(delta, key, current) {
  if (key === "fearGreed") {
    if (!Number.isFinite(delta)) return "—"
    const sign = delta > 0 ? "+" : ""
    const n = Math.abs(delta) < 1 ? delta.toFixed(1) : String(Math.round(delta))
    return `${sign}${n}`
  }
  if (Number.isFinite(current)) {
    const label = getStatus(key, current).label
    return label === "-" ? "—" : label
  }
  return "—"
}

/** @param {number[]} values */
function buildSparkline(values) {
  const last7 = values.filter(Number.isFinite).slice(-7)
  if (last7.length < 2) return null
  const min = Math.min(...last7)
  const max = Math.max(...last7)
  const glyphs = ["▁", "▂", "▃", "▄", "▅", "▆", "▇"]
  return last7
    .map((v) => {
      if (max === min) return glyphs[3]
      const idx = Math.round(((v - min) / (max - min)) * (glyphs.length - 1))
      return glyphs[Math.min(glyphs.length - 1, Math.max(0, idx))]
    })
    .join("")
}

/**
 * @param {HomeV5CoreKey} key
 * @param {object | null | undefined} panicData
 * @param {object[]} historyRows
 */
/** @param {object | null | undefined} panicData @param {HomeV5CoreKey} key */
function currentFromPanic(panicData, key) {
  if (!panicData) return null
  if (key === "highYield") {
    const n = Number(panicData.highYield ?? panicData.hyOas)
    return Number.isFinite(n) ? n : null
  }
  const n = Number(panicData[key])
  return Number.isFinite(n) ? n : null
}

export function buildHomeV5CoreTrend(key, panicData, historyRows = []) {
  const rows = sortHistoryRowsAsc(historyRows)
  const fromPanic = currentFromPanic(panicData, key)
  const series = historyValuesForMetric(rows, key)
  const current = Number.isFinite(fromPanic)
    ? fromPanic
    : series.length
      ? series[series.length - 1]
      : null

  const caption = CAPTIONS[key]

  if (current == null) {
    return {
      caption,
      trendArrow: "→",
      trendLine: "— (7일)",
      sparkline: null,
      trendDir: "flat",
    }
  }

  const anchorDate =
    rowDateKey(panicData) && /^\d{4}-\d{2}-\d{2}$/.test(String(panicData.date))
      ? rowDateKey(panicData)
      : rows.length
        ? rowDateKey(rows[rows.length - 1])
        : null

  let baseline = null
  if (anchorDate) {
    baseline = valueOnOrBefore(rows, subtractCalendarDays(anchorDate, 7), key)
  }
  if (baseline == null && series.length >= 2) {
    const lookback = Math.min(7, series.length - 1)
    baseline = series[series.length - 1 - lookback]
  }

  const delta = baseline != null ? current - baseline : null
  const trendDir = classifyDirection(delta ?? 0, key)
  const arrow = trendArrow(trendDir)
  const detail = trendDetail(delta ?? 0, key, current)
  const trendLine =
    key === "fearGreed" && Number.isFinite(delta)
      ? `${arrow} ${detail} (7일)`
      : `${arrow} ${detail} (7일)`

  const sparkValues =
    series.length >= 2
      ? series
      : baseline != null && Number.isFinite(current)
        ? [baseline, current]
        : []

  return {
    caption,
    trendArrow: arrow,
    trendLine,
    sparkline: buildSparkline(sparkValues),
    trendDir,
  }
}
