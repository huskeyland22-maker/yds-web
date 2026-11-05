/**
 * Firebase authDomain resolution for multi-host deploys.
 *
 * Google OAuth redirect_uri is always:
 *   https://<authDomain>/__/auth/handler
 *
 * Browsers that partition third-party storage (Chrome M115+, Safari 16.1+,
 * mobile Chrome/Firefox on iOS) break signInWithRedirect when authDomain is a
 * different origin than the page (e.g. *.firebaseapp.com vs *.vercel.app).
 * Symptom: getRedirectResult() → null, no Firebase error → auth_handoff_empty.
 *
 * Fix (Firebase Option 3): authDomain = page hostname + transparent proxy of
 * /__/auth and /__/firebase to the Firebase project (see vercel.json).
 * Production and Preview Vercel hosts both use same-origin authDomain.
 *
 * Google Cloud OAuth client must allow:
 *   https://<that-host>/__/auth/handler
 * Production host is already registered. Preview branch alias must be added
 * once or redirect_uri_mismatch appears (loud) instead of silent handoff empty.
 */

export const FIREBASE_PROJECT_AUTH_DOMAIN = "yds-web-fec1e.firebaseapp.com"
export const FIREBASE_PRODUCTION_APP_HOST = "yds-web-kappa.vercel.app"
export const FIREBASE_REDIRECT_SETTLING_KEY = "yds.firebaseRedirectSettling"

/**
 * @param {string | null | undefined} configured
 * @param {{ hostname?: string } | null | undefined} loc
 * @returns {string}
 */
export function resolveFirebaseAuthDomain(configured, loc) {
  const projectDomain =
    typeof configured === "string" && configured.trim()
      ? configured.trim()
      : FIREBASE_PROJECT_AUTH_DOMAIN
  const hostname =
    typeof loc?.hostname === "string" && loc.hostname.trim()
      ? loc.hostname.trim().toLowerCase()
      : typeof window !== "undefined" && typeof window.location?.hostname === "string"
        ? window.location.hostname.trim().toLowerCase()
        : ""

  if (!hostname) return projectDomain
  // Same-origin authDomain on any Vercel app host (Prod + Preview aliases).
  // Relies on vercel.json transparent /__/auth proxy to firebaseapp.com.
  if (hostname === FIREBASE_PRODUCTION_APP_HOST || hostname.endsWith(".vercel.app")) {
    return hostname
  }
  // localhost / unknown → project authDomain (expect cross-origin limits on mobile).
  return projectDomain
}

/**
 * Exact Google OAuth redirect_uri derived from authDomain (Firebase Auth handler).
 * @param {string | null | undefined} authDomain
 * @returns {string | null}
 */
export function firebaseAuthHandlerRedirectUri(authDomain) {
  const host = typeof authDomain === "string" ? authDomain.trim().replace(/^https?:\/\//, "") : ""
  if (!host) return null
  return `https://${host}/__/auth/handler`
}

/**
 * @param {string | null | undefined} authDomain
 * @param {string | null | undefined} pageHostname
 * @returns {"same-origin" | "cross-origin" | "unknown"}
 */
export function resolveAuthHandoffMode(authDomain, pageHostname) {
  const domain =
    typeof authDomain === "string" ? authDomain.trim().toLowerCase().replace(/^https?:\/\//, "") : ""
  const host =
    typeof pageHostname === "string" ? pageHostname.trim().toLowerCase().replace(/^https?:\/\//, "") : ""
  if (!domain || !host) return "unknown"
  return domain === host ? "same-origin" : "cross-origin"
}

/**
 * @param {{ sessionStorage?: Storage } | null | undefined} storeTarget
 */
export function markFirebaseRedirectSettling(storeTarget = typeof window !== "undefined" ? window : null) {
  try {
    storeTarget?.sessionStorage?.setItem(FIREBASE_REDIRECT_SETTLING_KEY, "1")
  } catch {
    // ignore
  }
}

/**
 * @param {{ sessionStorage?: Storage } | null | undefined} storeTarget
 */
export function clearFirebaseRedirectSettling(storeTarget = typeof window !== "undefined" ? window : null) {
  try {
    storeTarget?.sessionStorage?.removeItem(FIREBASE_REDIRECT_SETTLING_KEY)
  } catch {
    // ignore
  }
}

/**
 * @param {{ sessionStorage?: Storage } | null | undefined} storeTarget
 */
export function isFirebaseRedirectSettling(storeTarget = typeof window !== "undefined" ? window : null) {
  try {
    return storeTarget?.sessionStorage?.getItem(FIREBASE_REDIRECT_SETTLING_KEY) === "1"
  } catch {
    return false
  }
}

/**
 * Decide whether an auth-null event should clear the UI user during redirect settle.
 * @param {{
 *   nextUser?: object | null
 *   redirectSettling?: boolean
 *   authCurrentUser?: object | null
 *   authBootPending?: boolean
 * }} input
 */
export function shouldClearUserOnAuthNull(input = {}) {
  if (input.nextUser) return false
  if (input.authCurrentUser) return false
  if (input.redirectSettling) return false
  if (input.authBootPending) return false
  return true
}
