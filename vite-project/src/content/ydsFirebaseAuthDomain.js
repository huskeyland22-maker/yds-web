/**
 * Firebase authDomain resolution for multi-host deploys.
 * Same-origin authDomain + vercel.json /__/auth rewrite avoids iOS Safari
 * losing the redirect session when authDomain stays on *.firebaseapp.com.
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
  if (hostname === FIREBASE_PRODUCTION_APP_HOST) return FIREBASE_PRODUCTION_APP_HOST
  if (hostname === "localhost" || hostname === "127.0.0.1") return hostname
  // Stable Preview / deployment aliases — require Firebase Authorized Domains entry.
  if (hostname.endsWith(".vercel.app")) return hostname
  return projectDomain
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
 * @param {{ nextUser?: object | null, redirectSettling?: boolean, authCurrentUser?: object | null }} input
 */
export function shouldClearUserOnAuthNull(input = {}) {
  if (input.nextUser) return false
  if (input.authCurrentUser) return false
  if (input.redirectSettling) return false
  return true
}
