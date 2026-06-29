/**
 * GO #85 — AI 추천 알림 저장소
 */

export const PICK_ALERT_PREFS_KEY = "yds-stock-pick-alert-prefs-v1"
export const PICK_ALERT_FEED_KEY = "yds-stock-pick-alert-feed-v1"

/** @typedef {'recommendStart' | 'entryReady' | 'recommendEnd' | 'scoreUp' | 'scoreDown' | 'targetHit' | 'stopSignal'} PickAlertType */

export const PICK_ALERT_TYPES = /** @type {const} */ ([
  { id: "recommendStart", label: "추천 시작" },
  { id: "entryReady", label: "매수 가능 진입" },
  { id: "recommendEnd", label: "추천 해제" },
  { id: "scoreUp", label: "AI 점수 상승" },
  { id: "scoreDown", label: "AI 점수 하락" },
  { id: "targetHit", label: "목표가 도달" },
  { id: "stopSignal", label: "손절 신호" },
])

/**
 * @typedef {{
 *   id: string
 *   ticker: string
 *   name: string
 *   type: PickAlertType
 *   message: string
 *   createdAt: number
 *   read: boolean
 * }} PickAlertRecord
 */

/**
 * @typedef {Record<string, Partial<Record<PickAlertType, boolean>>>} PickAlertPrefs
 */

/** @returns {PickAlertPrefs} */
export function loadPickAlertPrefs() {
  try {
    const raw = localStorage.getItem(PICK_ALERT_PREFS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

/** @param {PickAlertPrefs} prefs */
export function savePickAlertPrefs(prefs) {
  localStorage.setItem(PICK_ALERT_PREFS_KEY, JSON.stringify(prefs))
}

/** @returns {PickAlertRecord[]} */
export function loadPickAlertFeed() {
  try {
    const raw = localStorage.getItem(PICK_ALERT_FEED_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** @param {PickAlertRecord[]} feed */
export function savePickAlertFeed(feed) {
  localStorage.setItem(PICK_ALERT_FEED_KEY, JSON.stringify(feed.slice(0, 200)))
}

/** @param {PickAlertRecord} alert */
export function appendPickAlert(alert) {
  const feed = loadPickAlertFeed()
  if (feed.some((a) => a.id === alert.id)) return feed
  const next = [alert, ...feed].slice(0, 200)
  savePickAlertFeed(next)
  return next
}

export function countUnreadPickAlerts() {
  return loadPickAlertFeed().filter((a) => !a.read).length
}

export function markAllPickAlertsRead() {
  const feed = loadPickAlertFeed().map((a) => ({ ...a, read: true }))
  savePickAlertFeed(feed)
  return feed
}

/** @param {string} ticker @param {PickAlertType} type */
export function isAlertEnabled(ticker, type, prefs = loadPickAlertPrefs()) {
  const sym = String(ticker).toUpperCase()
  const row = prefs[sym]
  if (!row) return true
  return row[type] !== false
}

/** @param {string} ticker @param {PickAlertType} type @param {boolean} enabled */
export function setAlertEnabled(ticker, type, enabled) {
  const prefs = loadPickAlertPrefs()
  const sym = String(ticker).toUpperCase()
  prefs[sym] = { ...(prefs[sym] ?? {}), [type]: enabled }
  savePickAlertPrefs(prefs)
  return prefs
}
