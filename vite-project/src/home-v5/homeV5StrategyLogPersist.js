const LOG_KEY = "yds-home-v5-strategy-validation-log"
const MAX_ENTRIES = 500

/** @typedef {{
 *   id: string
 *   scenarioId: string
 *   scenarioLabel: string
 *   date: string
 *   statusEmoji: string
 *   statusLabel: string
 *   action: string
 *   rationale: string
 *   metrics: { cnn: number | null; vix: number | null; bofa: number | null; hy: number | null }
 *   recordedAt: string
 * }} HomeV5StrategyLogEntry */

/** @returns {HomeV5StrategyLogEntry[]} */
export function loadHomeV5StrategyLogs() {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(LOG_KEY)
    const arr = JSON.parse(raw || "[]")
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

/** @param {HomeV5StrategyLogEntry[]} entries */
export function saveHomeV5StrategyLogs(entries) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(LOG_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)))
  } catch {
    // ignore quota
  }
}

/** @param {HomeV5StrategyLogEntry | HomeV5StrategyLogEntry[]} entries */
export function appendHomeV5StrategyLogs(entries) {
  const incoming = Array.isArray(entries) ? entries : [entries]
  if (!incoming.length) return
  const merged = [...incoming, ...loadHomeV5StrategyLogs()].slice(0, MAX_ENTRIES)
  saveHomeV5StrategyLogs(merged)
}

export function clearHomeV5StrategyLogs() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(LOG_KEY)
  } catch {
    // ignore
  }
}
