export const PRECURSOR_MARKET_JOURNAL_STORAGE_KEY = "yds-precursor-market-journal-v1"
export const PRECURSOR_MARKET_JOURNAL_MAX_ENTRIES = 400

/**
 * @typedef {Object} PrecursorMarketJournalDailyEntry
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
 * @property {string} actionId
 * @property {string} actionLabel
 * @property {string} actionEmoji
 * @property {number} confidenceScore
 * @property {string} confidenceLabelId
 * @property {string} confidenceLabel
 * @property {string} journalText
 * @property {string} interpretation
 * @property {string | null} [radarAlertId]
 */

/**
 * @returns {PrecursorMarketJournalDailyEntry[]}
 */
export function loadPrecursorMarketJournal() {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(PRECURSOR_MARKET_JOURNAL_STORAGE_KEY)
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
 * @param {PrecursorMarketJournalDailyEntry[]} rows
 */
export function savePrecursorMarketJournal(rows) {
  if (typeof window === "undefined") return false
  const trimmed = [...rows]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-PRECURSOR_MARKET_JOURNAL_MAX_ENTRIES)
  try {
    window.localStorage.setItem(PRECURSOR_MARKET_JOURNAL_STORAGE_KEY, JSON.stringify(trimmed))
    return true
  } catch {
    return false
  }
}

/**
 * @param {PrecursorMarketJournalDailyEntry} entry
 */
export function upsertPrecursorMarketJournalEntry(entry) {
  const log = loadPrecursorMarketJournal()
  const date = entry.date?.slice(0, 10)
  if (!date) return { ok: false, log }
  const next = log.filter((r) => r.date !== date).concat([{ ...entry, date }])
  const ok = savePrecursorMarketJournal(next)
  return { ok, log: loadPrecursorMarketJournal() }
}

export function clearPrecursorMarketJournal() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(PRECURSOR_MARKET_JOURNAL_STORAGE_KEY)
}
