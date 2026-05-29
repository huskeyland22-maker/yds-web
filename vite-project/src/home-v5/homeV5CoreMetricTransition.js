import { buildHomeV5CoreTrend } from "./homeV5CoreTrend.js"
import { sortHistoryRowsAsc } from "../utils/panicHistoryDesk.js"

/** @typedef {"fearGreed" | "vix" | "bofa"} HomeV5CoreMetricKey */

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

/**
 * @param {object[]} rows asc
 * @param {string} anchorDate
 * @param {HomeV5CoreMetricKey} key
 */
function valueDaysAgo(rows, anchorDate, key, daysAgo) {
  const target = subtractCalendarDays(anchorDate, daysAgo)
  let picked = null
  for (const row of rows) {
    const dk = rowDateKey(row)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dk)) continue
    if (dk <= target) picked = row
    else break
  }
  if (!picked) return null
  const n = Number(picked[key])
  return Number.isFinite(n) ? n : null
}

/**
 * 핵심 지표별 최근 10일 흐름 기반 전환 라벨 (Transition 엔진 문체 정렬)
 * @param {HomeV5CoreMetricKey} key
 * @param {object | null | undefined} panicData
 * @param {object[]} [historyRows]
 * @returns {{ label: string; tone: "up" | "down" | "flat" }}
 */
export function resolveCoreMetricRecentChange(key, panicData, historyRows = []) {
  const trend = buildHomeV5CoreTrend(key, panicData, historyRows)
  const dir = trend.trendDir ?? "flat"
  const rows = sortHistoryRowsAsc(historyRows)
  const current = Number(panicData?.[key])

  if (!Number.isFinite(current)) {
    return { label: "—", tone: "flat" }
  }

  const anchorDate =
    rowDateKey(panicData) && /^\d{4}-\d{2}-\d{2}$/.test(String(panicData.date))
      ? rowDateKey(panicData)
      : rows.length
        ? rowDateKey(rows[rows.length - 1])
        : null

  const prev = anchorDate ? valueDaysAgo(rows, anchorDate, key, 8) : null
  const hasPrev = Number.isFinite(prev)

  if (dir === "flat" || !hasPrev) {
    return { label: "흐름 유지", tone: "flat" }
  }

  if (key === "fearGreed") {
    if (dir === "up") {
      if (current >= 60 && prev < 60) return { label: "탐욕 확대", tone: "up" }
      if (prev <= 40) return { label: "회복 강화", tone: "up" }
      return { label: "심리 개선", tone: "up" }
    }
    if (prev >= 75) return { label: "과열 완화", tone: "down" }
    if (current <= 40) return { label: "위험 증가", tone: "down" }
    return { label: "심리 약화", tone: "down" }
  }

  if (key === "vix") {
    if (dir === "up") {
      if (prev >= 25 || current >= 25) return { label: "위험 증가", tone: "down" }
      return { label: "변동성 확대", tone: "down" }
    }
    if (prev >= 22) return { label: "변동성 완화", tone: "up" }
    return { label: "안정 강화", tone: "up" }
  }

  if (dir === "up") {
    if (current >= 6.5 && prev < 6.5) return { label: "낙관 확대", tone: "up" }
    return { label: "낙관 강화", tone: "up" }
  }
  if (prev >= 7) return { label: "과열 완화", tone: "down" }
  if (current <= 2.5) return { label: "위험 증가", tone: "down" }
  return { label: "낙관 완화", tone: "down" }
}
