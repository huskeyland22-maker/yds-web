/**
 * panic_index_history 단일 source of truth — 데스크 차트·상단 카드.
 */

import { formatChartAxisMd } from "./chartDateFormat.js"
import { panicIndexRowToCycleChart } from "./panicIndexHistory.js"

function rowDateKey(row) {
  return String(row?.date ?? row?.ts ?? "").slice(0, 10)
}

/** @param {object[]} rows */
export function sortHistoryRowsAsc(rows) {
  return [...(rows || [])]
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(rowDateKey(r)))
    .sort((a, b) => rowDateKey(a).localeCompare(rowDateKey(b)))
}

/** order by date desc limit 1 */
export function latestHistoryRow(rows) {
  const sorted = sortHistoryRowsAsc(rows)
  if (!sorted.length) return null
  return sorted[sorted.length - 1]
}

/** API history row → cycle chart row */
export function historyRowsToCycleRows(hubRows) {
  if (!Array.isArray(hubRows)) return []
  return hubRows.map(panicIndexRowToCycleChart).filter(Boolean)
}

/**
 * Recharts용 chartData (connectNulls — 유효 값만, 날짜 오름차순)
 * @param {object[]} cycleRows
 * @param {string} dataKey
 */
export function buildChartDataFromHistory(cycleRows, dataKey = "vix") {
  const key = dataKey || "vix"
  const sorted = sortHistoryRowsAsc(cycleRows)
  const chartData = sorted
    .map((row) => {
      const date = rowDateKey(row)
      const v = Number(row[key])
      if (!Number.isFinite(v)) return null
      return {
        date,
        axisLabel: formatChartAxisMd(date),
        [key]: v,
        vix: Number.isFinite(Number(row.vix)) ? Number(row.vix) : undefined,
        fearGreed: Number.isFinite(Number(row.fearGreed)) ? Number(row.fearGreed) : undefined,
        putCall: Number.isFinite(Number(row.putCall)) ? Number(row.putCall) : undefined,
        highYield: Number.isFinite(Number(row.highYield)) ? Number(row.highYield) : undefined,
        bofa: Number.isFinite(Number(row.bofa)) ? Number(row.bofa) : undefined,
      }
    })
    .filter(Boolean)
  return chartData
}

/** @param {object[]} cycleRows */
export function panicDeskDataFromHistory(cycleRows) {
  const last = latestHistoryRow(cycleRows)
  if (!last) return null
  const pick = (k) => {
    const n = Number(last[k])
    return Number.isFinite(n) ? n : null
  }
  const date = rowDateKey(last)
  return {
    vix: pick("vix"),
    vxn: pick("vxn"),
    fearGreed: pick("fearGreed"),
    putCall: pick("putCall"),
    bofa: pick("bofa"),
    move: pick("move"),
    skew: pick("skew"),
    highYield: pick("highYield"),
    gsBullBear: pick("gsBullBear"),
    updatedAt: last.ts ?? `${date}T12:00:00.000Z`,
    accessTier: "pro",
    __fromHistory: true,
  }
}

export function logHistoryChartDebug(historyRows, chartData) {
  console.log("history rows", historyRows)
  console.log("chartData", chartData)
}
