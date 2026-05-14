/**
 * Live / market data fetch policy — network-first, no HTTP cache reuse.
 *
 * - Vite build emits hashed immutable `/assets/*` only (app shell / CSS / fonts).
 * - Panic, macro, JSON feeds, and APIs must never rely on stale disk cache; use this module.
 * - Service Worker: production does not register Workbox; legacy SW is stripped in `pwaFreshness`.
 * - Future Capacitor wrapper: keep one origin + these helpers; avoid adding a second SW cache layer.
 */

/** @type {RequestInit} */
export const LIVE_JSON_GET_INIT = {
  method: "GET",
  cache: "no-store",
  headers: {
    Accept: "application/json",
    Pragma: "no-cache",
    "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
  },
}

/** @type {RequestInit} */
export const LIVE_POST_JSON_INIT = {
  method: "POST",
  cache: "no-store",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
    Pragma: "no-cache",
    "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
  },
}

/**
 * Bust intermediaries that ignore cache headers (notably some iOS WebView / PWA stacks).
 * @param {string} url
 */
export function withNoStoreQuery(url) {
  const u = String(url || "").trim()
  if (!u) return u
  const sep = u.includes("?") ? "&" : "?"
  return `${u}${sep}t=${Date.now()}`
}

/**
 * @param {string} url
 * @param {RequestInit} [extra]
 */
export async function fetchLiveJson(url, extra = {}) {
  const res = await fetch(withNoStoreQuery(url), { ...LIVE_JSON_GET_INIT, ...extra })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
