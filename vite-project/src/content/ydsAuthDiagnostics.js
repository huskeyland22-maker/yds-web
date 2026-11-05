/**
 * Preview / debug-only Firebase auth diagnostics.
 * Never stores or exposes email, ID tokens, access tokens, passwords, or cookies.
 */

import { FIREBASE_PRODUCTION_APP_HOST } from "./ydsFirebaseAuthDomain.js"

export const YDS_AUTH_DIAG_WINDOW_KEY = "__YDS_AUTH_DIAG"
export const YDS_AUTH_DEBUG_QUERY = "yds_auth_debug"

/**
 * @typedef {object} YdsAuthDiagSnapshot
 * @property {boolean} authConfigPresent
 * @property {boolean} authInstancePresent
 * @property {boolean} authInitialized
 * @property {boolean} authBootReady
 * @property {boolean} authLoading
 * @property {boolean} redirectSettling
 * @property {boolean | null} redirectResultHasUser
 * @property {boolean | null} redirectResultPresent
 * @property {string | null} redirectErrorCode
 * @property {boolean | null} currentUserPresent
 * @property {boolean | null} onAuthStateChangedHasUser
 * @property {string | null} authDomain
 * @property {string | null} handlerRedirectUri
 * @property {string | null} pageHostname
 * @property {string | null} membershipStatus
 * @property {string | null} lastUpdatedAt
 */

/** @returns {YdsAuthDiagSnapshot} */
export function createEmptyAuthDiagSnapshot() {
  return {
    authConfigPresent: false,
    authInstancePresent: false,
    authInitialized: false,
    authBootReady: false,
    authLoading: true,
    redirectSettling: false,
    redirectResultHasUser: null,
    redirectResultPresent: null,
    redirectErrorCode: null,
    currentUserPresent: null,
    onAuthStateChangedHasUser: null,
    authDomain: null,
    handlerRedirectUri: null,
    pageHostname: null,
    membershipStatus: null,
    lastUpdatedAt: null,
  }
}

/**
 * Merge patch into previous snapshot without accepting secret fields.
 * @param {YdsAuthDiagSnapshot} prev
 * @param {Partial<YdsAuthDiagSnapshot>} patch
 * @returns {YdsAuthDiagSnapshot}
 */
export function mergeAuthDiagSnapshot(prev, patch = {}) {
  const base = prev && typeof prev === "object" ? prev : createEmptyAuthDiagSnapshot()
  const next = { ...base }
  const allowed = Object.keys(createEmptyAuthDiagSnapshot())
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      next[key] = patch[key]
    }
  }
  next.lastUpdatedAt = new Date().toISOString()
  return next
}

/**
 * Publish safe snapshot for Preview console inspection.
 * @param {YdsAuthDiagSnapshot} snapshot
 * @param {Window | null | undefined} target
 */
export function publishAuthDiagSnapshot(snapshot, target = typeof window !== "undefined" ? window : null) {
  if (!target || typeof target !== "object") return
  try {
    target[YDS_AUTH_DIAG_WINDOW_KEY] = snapshot
  } catch {
    // ignore
  }
}

/**
 * Show auth debug chrome on Preview hosts or when explicitly requested.
 * Production app host never auto-shows (query/localStorage override only).
 * @param {{ hostname?: string, search?: string, localStorage?: Storage } | null | undefined} loc
 */
export function shouldShowAuthDebugPanel(loc = typeof window !== "undefined" ? window.location : null) {
  if (!loc) return false
  const hostname =
    typeof loc.hostname === "string" ? loc.hostname.trim().toLowerCase() : ""
  let search = typeof loc.search === "string" ? loc.search : ""
  let forced = false
  try {
    if (typeof window !== "undefined") {
      search = search || window.location.search || ""
      forced =
        new URLSearchParams(search).get(YDS_AUTH_DEBUG_QUERY) === "1" ||
        window.localStorage?.getItem("yds-auth-debug") === "1"
    } else if (search) {
      forced = new URLSearchParams(search).get(YDS_AUTH_DEBUG_QUERY) === "1"
    }
  } catch {
    forced = false
  }

  if (hostname === FIREBASE_PRODUCTION_APP_HOST) return forced
  if (forced) return true
  if (hostname.endsWith(".vercel.app")) return true
  if (hostname === "localhost" || hostname === "127.0.0.1") return forced
  return false
}

/**
 * Whether UI should treat auth as still settling (hide premature logout CTA).
 * @param {{ authBootReady?: boolean, redirectSettling?: boolean, hasUser?: boolean }} input
 */
export function isAuthUiPending(input = {}) {
  if (input.hasUser) return false
  if (input.redirectSettling) return true
  if (input.authBootReady === false) return true
  return false
}
