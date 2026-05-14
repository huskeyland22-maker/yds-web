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

function runtimeBuildQueryParam() {
  try {
    const bid =
      typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_APP_BUILD_ID != null
        ? String(import.meta.env.VITE_APP_BUILD_ID)
        : ""
    if (!bid || bid === "undefined") return ""
    return `b=${encodeURIComponent(bid)}`
  } catch {
    return ""
  }
}

/**
 * Bust intermediaries that ignore cache headers (notably some iOS WebView / PWA stacks).
 * Appends `t` (timestamp) and, when defined, `b` (Vite build id) so CDNs cannot serve a stale JSON/API response keyed on URL alone.
 * @param {string} url
 */
export function withNoStoreQuery(url) {
  const u = String(url || "").trim()
  if (!u) return u
  const sep = u.includes("?") ? "&" : "?"
  const b = runtimeBuildQueryParam()
  const parts = [`t=${Date.now()}`]
  if (b) parts.push(b)
  return `${u}${sep}${parts.join("&")}`
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
