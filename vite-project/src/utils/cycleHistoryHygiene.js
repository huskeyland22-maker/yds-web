/**
 * 2024 샘플·mock·정적 JSON 잔존 차단 — 사이클·패닉 히스토리 공통.
 */

export const CYCLE_HISTORY_KEY = "yds-cycle-metric-history-v1"
export const CYCLE_HISTORY_MAX = 120
export const MIN_CYCLE_HISTORY_UTC = Date.UTC(2025, 0, 1)

/** @param {string | undefined | null} dateStr YYYY-MM-DD */
export function isStaleHistoryCalendarDate(dateStr) {
  const d = String(dateStr ?? "").trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return true
  if (/^2024-/.test(d)) return true
  const t = Date.parse(`${d}T12:00:00.000Z`)
  if (!Number.isFinite(t)) return true
  return t < MIN_CYCLE_HISTORY_UTC
}

/** @param {unknown[]} rows */
export function filterFreshCycleHistoryRows(rows) {
  if (!Array.isArray(rows)) return []
  return rows.filter((r) => {
    if (!r || typeof r !== "object") return false
    const key = String(r.date ?? r.ts ?? "").slice(0, 10)
    return !isStaleHistoryCalendarDate(key)
  })
}

export function rowCalendarKey(row) {
  if (!row || typeof row !== "object") return ""
  if (row.date) return String(row.date).slice(0, 10)
  if (row.ts) return String(row.ts).slice(0, 10)
  return ""
}

export function calendarKeyFromPanic(panicData) {
  const u = panicData?.updatedAt ?? panicData?.updated_at
  if (typeof u === "string" && /^\d{4}-\d{2}-\d{2}/.test(u)) {
    const day = u.slice(0, 10)
    if (!isStaleHistoryCalendarDate(day)) return day
  }
  return new Date().toISOString().slice(0, 10)
}

/**
 * 로컬에 남은 2024 mock·샘플 히스토리 제거.
 * @returns {{ purgedCycle: boolean, purgedIndex: boolean }}
 */
export function purgeStaleCycleLocalStorage() {
  if (typeof window === "undefined") return { purgedCycle: false, purgedIndex: false }
  let purgedCycle = false
  let purgedIndex = false
  try {
    const raw = window.localStorage.getItem(CYCLE_HISTORY_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const fresh = filterFreshCycleHistoryRows(Array.isArray(parsed) ? parsed : [])
      if (fresh.length !== (Array.isArray(parsed) ? parsed.length : 0)) {
        if (fresh.length) window.localStorage.setItem(CYCLE_HISTORY_KEY, JSON.stringify(fresh))
        else window.localStorage.removeItem(CYCLE_HISTORY_KEY)
        purgedCycle = true
      }
    }
  } catch {
    window.localStorage.removeItem(CYCLE_HISTORY_KEY)
    purgedCycle = true
  }
  try {
    const key = "yds-panic-index-history-v1"
    const raw = window.localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const fresh = parsed.filter((r) => !isStaleHistoryCalendarDate(r?.date))
        if (fresh.length !== parsed.length) {
          if (fresh.length) window.localStorage.setItem(key, JSON.stringify(fresh))
          else window.localStorage.removeItem(key)
          purgedIndex = true
        }
      }
    }
  } catch {
    window.localStorage.removeItem("yds-panic-index-history-v1")
    purgedIndex = true
  }
  return { purgedCycle, purgedIndex }
}
