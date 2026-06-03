export const PRECURSOR_VALIDATION_LOG_STORAGE_KEY = "yds-precursor-validation-log-v1"
export const PRECURSOR_VALIDATION_LOG_MAX_ENTRIES = 400

/**
 * @typedef {Object} PrecursorValidationDailySnapshot
 * @property {string} date YYYY-MM-DD
 * @property {string} savedAt ISO
 * @property {number | null} ydsScore
 * @property {number | null} priA
 * @property {number | null} priB
 * @property {string} regimeId
 * @property {string} regimeLabel
 * @property {string} regimeEmoji
 * @property {string | null} dominantPatternId
 * @property {string} dominantPatternLabel
 * @property {number | null} dominantSimilarity
 * @property {{ rank: number; patternId: string; patternLabel: string; similarity: number }[]} patternRanks
 * @property {string} interpretation
 * @property {string | null} [radarAlertId]
 */

/**
 * @returns {PrecursorValidationDailySnapshot[]}
 */
export function loadPrecursorValidationLog() {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(PRECURSOR_VALIDATION_LOG_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((r) => r && typeof r.date === "string")
      .sort((a, b) => a.date.localeCompare(b.date))
  } catch {
    return []
  }
}

/**
 * @param {PrecursorValidationDailySnapshot[]} rows
 */
export function savePrecursorValidationLog(rows) {
  if (typeof window === "undefined") return false
  const trimmed = [...rows]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-PRECURSOR_VALIDATION_LOG_MAX_ENTRIES)
  try {
    window.localStorage.setItem(PRECURSOR_VALIDATION_LOG_STORAGE_KEY, JSON.stringify(trimmed))
    return true
  } catch {
    return false
  }
}

/**
 * @param {PrecursorValidationDailySnapshot} snapshot
 */
export function upsertPrecursorValidationSnapshot(snapshot) {
  const log = loadPrecursorValidationLog()
  const date = snapshot.date?.slice(0, 10)
  if (!date) return { ok: false, log }
  const next = log.filter((r) => r.date !== date).concat([{ ...snapshot, date }])
  const ok = savePrecursorValidationLog(next)
  return { ok, log: loadPrecursorValidationLog() }
}

export function clearPrecursorValidationLog() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(PRECURSOR_VALIDATION_LOG_STORAGE_KEY)
}
