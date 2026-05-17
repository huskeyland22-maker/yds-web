import {
  CYCLE_HISTORY_MAX,
  CYCLE_HISTORY_KEY,
  calendarKeyFromPanic,
  filterFreshCycleHistoryRows,
  isStaleHistoryCalendarDate,
  rowCalendarKey,
} from "./cycleHistoryHygiene.js"

export { CYCLE_HISTORY_KEY, CYCLE_HISTORY_MAX, calendarKeyFromPanic, filterFreshCycleHistoryRows }

export function readCycleMetricHistoryFromLS() {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(CYCLE_HISTORY_KEY)
    const arr = JSON.parse(raw || "[]")
    return filterFreshCycleHistoryRows(Array.isArray(arr) ? arr : [])
  } catch {
    return []
  }
}

export function writeCycleMetricHistoryToLS(rows) {
  if (typeof window === "undefined") return
  const fresh = filterFreshCycleHistoryRows(rows)
  try {
    if (fresh.length) window.localStorage.setItem(CYCLE_HISTORY_KEY, JSON.stringify(fresh))
    else window.localStorage.removeItem(CYCLE_HISTORY_KEY)
  } catch {
    // ignore
  }
}

/** 공개 cycle-metrics / Supabase 행 → 차트용 */
export function normalizeCycleHistoryRows(raw) {
  if (!Array.isArray(raw)) return []
  const rows = raw
    .map((r) => {
      if (!r || typeof r !== "object") return null
      const dateStr = String(r.date || r.ts || "").trim().slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || isStaleHistoryCalendarDate(dateStr)) return null
      const ts = typeof r.ts === "string" && r.ts.includes("T") ? r.ts : `${dateStr}T12:00:00.000Z`
      const pick = (k) => {
        const v = r[k]
        const n = Number(v)
        return Number.isFinite(n) ? n : null
      }
      const o = { date: dateStr, ts }
      const take = (key, val) => {
        if (Number.isFinite(val)) o[key] = val
      }
      take("vix", pick("vix"))
      take("vxn", pick("vxn"))
      take("putCall", pick("putCall"))
      take("fearGreed", pick("fearGreed"))
      take("move", pick("move"))
      take("bofa", pick("bofa"))
      take("skew", pick("skew"))
      take("highYield", pick("highYield"))
      const gs = pick("gsBullBear")
      take("gsBullBear", Number.isFinite(gs) ? gs : pick("gs"))
      return o
    })
    .filter(Boolean)
  rows.sort((a, b) => String(a.ts).localeCompare(String(b.ts)))
  return rows
}

export function mergeCycleRows(rowsA, rowsB) {
  const out = new Map()
  for (const row of filterFreshCycleHistoryRows([...(rowsA || []), ...(rowsB || [])])) {
    const key = rowCalendarKey(row)
    if (!key || isStaleHistoryCalendarDate(key)) continue
    const prevRow = out.get(key)
    out.set(key, prevRow ? { ...prevRow, ...row } : { ...row })
  }
  return [...out.values()].sort((a, b) => String(a.ts).localeCompare(String(b.ts))).slice(-CYCLE_HISTORY_MAX)
}

/** panicData 스냅샷으로 당일 행 1개 생성 */
export function buildCycleRowFromPanic(panicData) {
  if (!panicData || typeof panicData !== "object") return null
  const dayKey = calendarKeyFromPanic(panicData)
  if (isStaleHistoryCalendarDate(dayKey)) return null
  const row = { date: dayKey, ts: `${dayKey}T12:00:00.000Z` }
  const noZeroSentinel = new Set(["vix", "vxn", "move", "skew", "bofa", "highYield", "fearGreed", "gsBullBear"])
  const add = (k, v) => {
    const n = Number(v)
    if (!Number.isFinite(n)) return
    if (n === 0 && noZeroSentinel.has(k)) return
    row[k] = n
  }
  add("vix", panicData.vix)
  add("vxn", panicData.vxn)
  add("putCall", panicData.putCall)
  add("fearGreed", panicData.fearGreed)
  add("move", panicData.move)
  add("bofa", panicData.bofa)
  add("skew", panicData.skew)
  add("highYield", panicData.highYield)
  add("gsBullBear", panicData.gsBullBear)
  const validKeys = ["vix", "fearGreed", "putCall", "highYield"]
  if (!validKeys.every((k) => Number.isFinite(row[k]))) return null
  return row
}

/** cycle 차트 최신 행 → panicStore·상단 카드 호환 객체 */
export function panicDataFromCycleRow(row) {
  if (!row || typeof row !== "object") return null
  const pick = (k) => {
    const n = Number(row[k])
    return Number.isFinite(n) ? n : null
  }
  const ts = row.ts ?? (row.date ? `${String(row.date).slice(0, 10)}T12:00:00.000Z` : null)
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
    updatedAt: ts,
    accessTier: "pro",
  }
}

/** @param {object[]} rows — date 오름차순 배열이면 마지막 = 최신 */
export function latestCycleHistoryRow(rows) {
  if (!Array.isArray(rows) || !rows.length) return null
  return rows[rows.length - 1]
}

export { latestHistoryRow, panicDeskDataFromHistory } from "./panicHistoryDesk.js"
