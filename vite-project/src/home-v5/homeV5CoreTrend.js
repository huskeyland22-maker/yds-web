import { sortHistoryRowsAsc } from "../utils/panicHistoryDesk.js"

/** @typedef {"fearGreed" | "vix" | "bofa"} HomeV5CoreKey */
/** @typedef {"up" | "down" | "flat"} HomeV5TrendDir */

/** 최근 10일 · 2일 간격 5포인트 (t-8 … t-0) */
const TIMELINE_OFFSET_DAYS = [8, 6, 4, 2, 0]

const FLAT_THRESHOLDS = {
  fearGreed: 2,
  vix: 0.5,
  bofa: 0.15,
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

/** @param {HomeV5CoreKey} key @param {number} value */
function formatTimelineValue(key, value) {
  if (!Number.isFinite(value)) return "—"
  if (key === "vix") return Number.isInteger(value) ? String(value) : value.toFixed(1)
  if (key === "bofa") return value.toFixed(1)
  return String(Math.round(value))
}

/** @param {HomeV5CoreKey} key @param {number} delta */
function formatChangeDelta(key, delta) {
  if (!Number.isFinite(delta)) return "—"
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : ""
  const abs = Math.abs(delta)
  if (key === "fearGreed") return `${sign}${Math.round(abs)}`
  if (key === "vix") {
    const n = abs < 10 && !Number.isInteger(abs) ? abs.toFixed(1) : String(Math.round(abs))
    return `${sign}${n}`
  }
  return `${sign}${abs.toFixed(1)}`
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

/** @param {object | null | undefined} panicData @param {HomeV5CoreKey} key */
function currentFromPanic(panicData, key) {
  if (!panicData) return null
  const n = Number(panicData[key])
  return Number.isFinite(n) ? n : null
}

/**
 * @param {object[]} rows
 * @param {string} anchorDate
 * @param {HomeV5CoreKey} key
 * @param {number | null} current
 */
function buildTimelineValues(rows, anchorDate, key, current) {
  const raw = TIMELINE_OFFSET_DAYS.map((daysAgo) => {
    if (daysAgo === 0 && current != null) return current
    return valueOnOrBefore(rows, subtractCalendarDays(anchorDate, daysAgo), key)
  })

  let lastKnown = null
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] != null) lastKnown = raw[i]
    else if (lastKnown != null) raw[i] = lastKnown
  }
  let nextKnown = null
  for (let i = raw.length - 1; i >= 0; i -= 1) {
    if (raw[i] != null) nextKnown = raw[i]
    else if (nextKnown != null) raw[i] = nextKnown
  }
  if (current != null) raw[raw.length - 1] = current
  return raw
}

/**
 * @param {HomeV5CoreKey} key
 * @param {object | null | undefined} panicData
 * @param {object[]} historyRows
 */
export function buildHomeV5CoreTrend(key, panicData, historyRows = []) {
  const rows = sortHistoryRowsAsc(historyRows)
  const current = currentFromPanic(panicData, key)

  if (current == null) {
    return {
      timelineText: "—",
      changeText: "→ —",
      trendDir: "flat",
      trendArrow: "→",
      trendLine: "—",
    }
  }

  const anchorDate =
    rowDateKey(panicData) && /^\d{4}-\d{2}-\d{2}$/.test(String(panicData.date))
      ? rowDateKey(panicData)
      : rows.length
        ? rowDateKey(rows[rows.length - 1])
        : null

  const values = anchorDate ? buildTimelineValues(rows, anchorDate, key, current) : [current]
  const finite = values.filter((v) => Number.isFinite(v))
  const labels = values.map((v) => formatTimelineValue(key, v))
  const timelineText = labels.join(" → ")

  const first = finite[0] ?? current
  const last = finite[finite.length - 1] ?? current
  const delta = last - first
  const trendDir = classifyDirection(delta, key)
  const arrow = trendArrow(trendDir)
  const changeText = `${arrow} ${formatChangeDelta(key, delta)}`

  return {
    timelineText,
    changeText,
    trendDir,
    trendArrow: arrow,
    trendLine: `${timelineText} ${changeText}`,
  }
}
