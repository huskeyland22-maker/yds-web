/**
 * YDS Phase 4-1 — 행동 로그 저장소
 */

export const ACTION_LOG_STORAGE_KEY = "yds-action-log-v1"

/**
 * @typedef {import("./ydsComplianceEngine.js").ComplianceResult} ComplianceResult
 */

/**
 * @typedef {{
 *   panicLabel: string
 *   strategyLabel: string
 *   cycleLabel: string
 *   marketLabel: string
 *   macroId: string
 *   ydsScore: number | null
 * }} YdsActionLogStateSnapshot
 */

/**
 * @typedef {{
 *   id: string
 *   date: string
 *   createdAt: number
 *   updatedAt: number
 *   memo: string
 *   ydsState: YdsActionLogStateSnapshot
 *   recommended: { usPct: number; krPct: number; cashPct: number }
 *   actual: { usPct: number; krPct: number; cashPct: number }
 *   compliance: ComplianceResult
 *   compliancePct: number
 *   gapPct: number
 *   startAsset: number | null
 *   endAsset: number | null
 *   returnPct: number | null
 * }} YdsActionLogEntry
 */

/** @returns {YdsActionLogEntry[]} */
export function loadActionLogs() {
  try {
    const raw = localStorage.getItem(ACTION_LOG_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((e) => e && typeof e.id === "string")
  } catch {
    return []
  }
}

/** @param {YdsActionLogEntry[]} entries */
export function saveActionLogs(entries) {
  try {
    localStorage.setItem(ACTION_LOG_STORAGE_KEY, JSON.stringify(entries))
  } catch {
    /* ignore */
  }
}

/** @param {string} id @param {YdsActionLogEntry[]} entries */
export function deleteActionLogById(id, entries) {
  return entries.filter((e) => e.id !== id)
}

/** @param {YdsActionLogEntry} entry @param {YdsActionLogEntry[]} entries */
export function upsertActionLog(entry, entries) {
  const idx = entries.findIndex((e) => e.id === entry.id)
  if (idx >= 0) {
    const next = [...entries]
    next[idx] = entry
    return sortActionLogsNewest(next)
  }
  return sortActionLogsNewest([entry, ...entries])
}

/** @param {YdsActionLogEntry[]} entries */
export function sortActionLogsNewest(entries) {
  return [...entries].sort((a, b) => {
    const da = Date.parse(a.date) || a.createdAt
    const db = Date.parse(b.date) || b.createdAt
    return db - da
  })
}

/** @returns {string} */
export function createActionLogId() {
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** @returns {string} */
export function todayDateKey() {
  return new Date().toISOString().slice(0, 10)
}

/** @param {string} date @returns {string} */
export function formatActionLogDate(date) {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return date
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${m}/${day}`
}
