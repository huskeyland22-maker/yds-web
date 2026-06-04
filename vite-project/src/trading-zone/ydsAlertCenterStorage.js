export const ALERT_CENTER_STORAGE_KEY = "yds-alert-center-v1"
export const ALERT_HISTORY_MAX = 100

/**
 * @typedef {{
 *   id: string
 *   grade: 'S' | 'A' | 'B' | 'C'
 *   category: 'realtime' | 'stock' | 'market'
 *   subtype: string
 *   title: string
 *   body: string
 *   at: string
 *   symbol?: string | null
 *   stockName?: string | null
 *   causes?: string[]
 * }} AlertRow
 */

/**
 * @typedef {{
 *   asOf: string | null
 *   stageId: string | null
 *   sectorRanks: { id: string; rank: number }[]
 *   stocks: { id: string; watchStateId: string; statusId: string }[]
 * }} AlertCenterSnapshot
 */

function emptyStore() {
  return {
    version: 1,
    snapshot: /** @type {AlertCenterSnapshot | null} */ (null),
    history: /** @type {AlertRow[]} */ ([]),
  }
}

export function loadAlertCenterStore() {
  if (typeof window === "undefined") return emptyStore()
  try {
    const raw = window.localStorage.getItem(ALERT_CENTER_STORAGE_KEY)
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw)
    return {
      version: 1,
      snapshot: parsed.snapshot ?? null,
      history: Array.isArray(parsed.history) ? parsed.history : [],
    }
  } catch {
    return emptyStore()
  }
}

/** @param {ReturnType<typeof loadAlertCenterStore>} store */
export function saveAlertCenterStore(store) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(
    ALERT_CENTER_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      snapshot: store.snapshot,
      history: (store.history ?? []).slice(0, ALERT_HISTORY_MAX),
    }),
  )
}

/** @param {AlertCenterSnapshot} snapshot */
export function saveAlertCenterSnapshot(snapshot) {
  const store = loadAlertCenterStore()
  store.snapshot = snapshot
  saveAlertCenterStore(store)
}

export function loadAlertCenterSnapshot() {
  return loadAlertCenterStore().snapshot
}

export function loadAlertHistory() {
  return loadAlertCenterStore().history.slice(0, ALERT_HISTORY_MAX)
}

/** @param {AlertRow[]} rows */
export function appendAlertHistory(rows) {
  if (!rows.length) return
  const store = loadAlertCenterStore()
  const existingIds = new Set(store.history.map((h) => h.id))
  const merged = [...rows.filter((r) => !existingIds.has(r.id)), ...store.history]
  store.history = merged.slice(0, ALERT_HISTORY_MAX)
  saveAlertCenterStore(store)
}

export function clearAlertHistory() {
  const store = loadAlertCenterStore()
  store.history = []
  saveAlertCenterStore(store)
}
