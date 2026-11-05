/**
 * Firebase authDomain resolution for multi-host deploys.
 *
 * Google OAuth redirect_uri is always:
 *   https://<authDomain>/__/auth/handler
 *
 * Production uses the custom app host (already registered on the Firebase
 * Google OAuth client). Preview must NOT use the Preview hostname as
 * authDomain — that produces redirect_uri_mismatch unless every Preview
 * alias is manually added to Google Cloud Authorized redirect URIs.
 *
 * Preview keeps the Firebase project authDomain so redirect_uri stays:
 *   https://yds-web-fec1e.firebaseapp.com/__/auth/handler
 * The Preview page origin still must be in Firebase Authorized domains.
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
  // Only Production custom host uses same-origin authDomain (OAuth client already allows it).
  if (hostname === FIREBASE_PRODUCTION_APP_HOST) return FIREBASE_PRODUCTION_APP_HOST
  // Preview / localhost / other hosts → project authDomain (stable Google redirect_uri).
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
