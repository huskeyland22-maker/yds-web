/**
 * eventHistory.json 호환 누적 저장 (localStorage)
 */

/** @typedef {import("./ydsMarketTimeline.js").TimelineEventRecord} TimelineEventRecord */

export const EVENT_HISTORY_STORAGE_KEY = "yds-event-history-v3"
export const EVENT_HISTORY_STORAGE_KEY_LEGACY = "yds-event-history-v2"
export const EVENT_HISTORY_JSON_PATH = "/data/eventHistory.json"
export const EVENT_HISTORY_MAX_STORED = 500

/**
 * @typedef {{
 *   version: number
 *   updatedAt?: string | null
 *   events: TimelineEventRecord[]
 * }} EventHistoryDocument
 */

/**
 * @param {unknown} raw
 * @returns {TimelineEventRecord[]}
 */
export function normalizeEventHistoryEvents(raw) {
  if (!raw || typeof raw !== "object") return []
  const events = /** @type {{ events?: unknown }} */ (raw).events
  if (!Array.isArray(events)) return []
  return events
    .filter((ev) => ev && typeof ev === "object")
    .map((ev) => {
      const row = /** @type {TimelineEventRecord} */ (ev)
      return {
        date: String(row.date ?? "").slice(0, 10),
        type: String(row.type ?? ""),
        severity: row.severity === "high" || row.severity === "low" ? row.severity : "medium",
        title: String(row.title ?? ""),
        metrics: String(row.metrics ?? ""),
        action: String(row.action ?? row.description ?? ""),
        description: String(row.description ?? row.action ?? ""),
      }
    })
    .filter((ev) => /^\d{4}-\d{2}-\d{2}$/.test(ev.date) && ev.type && ev.title)
}

/** @returns {TimelineEventRecord[]} */
export function loadStoredEventHistory() {
  if (typeof window === "undefined") return []
  try {
    const rawV2 = window.localStorage.getItem(EVENT_HISTORY_STORAGE_KEY)
    if (rawV2) {
      return normalizeEventHistoryEvents(JSON.parse(rawV2))
    }
    return []
  } catch {
    return []
  }
}

/** 이전 버전 저장 키 제거 — 재스캔 정합성 확보 */
export function clearLegacyEventHistoryStorage() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(EVENT_HISTORY_STORAGE_KEY_LEGACY)
    window.localStorage.removeItem("yds-event-history-v1")
  } catch {
    /* ignore */
  }
}

/**
 * @param {TimelineEventRecord[]} events
 */
export function saveStoredEventHistory(events) {
  if (typeof window === "undefined") return
  const trimmed = events.slice(0, EVENT_HISTORY_MAX_STORED)
  const doc = {
    version: 1,
    updatedAt: new Date().toISOString(),
    events: trimmed,
  }
  window.localStorage.setItem(EVENT_HISTORY_STORAGE_KEY, JSON.stringify(doc))
}

/** @returns {Promise<TimelineEventRecord[]>} */
export async function fetchSeedEventHistory() {
  if (typeof window === "undefined") return []
  try {
    const res = await fetch(EVENT_HISTORY_JSON_PATH, { cache: "no-store" })
    if (!res.ok) return []
    const raw = await res.json()
    return normalizeEventHistoryEvents(raw)
  } catch {
    return []
  }
}

/**
 * @param {TimelineEventRecord[]} stored
 * @param {TimelineEventRecord[]} seed
 */
export function mergeSeedAndStored(stored, seed) {
  const map = new Map()
  for (const ev of [...seed, ...stored]) {
    map.set(`${ev.date}:${ev.type}`, ev)
  }
  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date))
}
