/**
 * Preview vs Production host helpers (client-safe).
 * Production app host must never be treated as Preview.
 */

/** @see ydsFirebaseAuthDomain.js — keep in sync */
export const PRODUCTION_APP_HOST = "yds-web-kappa.vercel.app"

/**
 * Vercel Git branch alias for `integration/yds-windows-mac`.
 * Prefer this for bookmarks — deployment-specific URLs go stale.
 */
export const STABLE_PREVIEW_HOST =
  "yds-web-git-integration-yds-windows-mac-so-sung-yangs-projects.vercel.app"

export const STABLE_PREVIEW_BOOKMARK_URL = `https://${STABLE_PREVIEW_HOST}/`

/**
 * @param {string} [hostname]
 * @returns {boolean}
 */
export function isProductionAppHost(hostname) {
  const host = String(hostname || "").trim().toLowerCase()
  return host === PRODUCTION_APP_HOST
}

/**
 * Vercel Preview deployment (branch alias or ephemeral) — not Production kappa.
 * @param {string} [hostname]
 * @returns {boolean}
 */
export function isVercelPreviewHost(hostname) {
  const host = String(hostname || "").trim().toLowerCase()
  if (!host || isProductionAppHost(host)) return false
  if (host === STABLE_PREVIEW_HOST) return true
  // Vercel Preview: {project}-git-{branch}-{team}.vercel.app or {project}-{hash}-{team}.vercel.app
  if (!host.endsWith(".vercel.app")) return false
  if (host.includes("-git-")) return true
  // Ephemeral deploy URLs still end with .vercel.app and are not kappa
  if (host.startsWith("yds-web-") && host !== PRODUCTION_APP_HOST) return true
  return false
}

/**
 * Stable branch alias — preferred bookmark target for Preview verification.
 * @param {string} [hostname]
 */
export function isStablePreviewBookmarkHost(hostname) {
  return String(hostname || "").trim().toLowerCase() === STABLE_PREVIEW_HOST
}

/**
 * PWA/build ops tools on Preview without enabling full isDevMode chrome.
 * @param {{ hostname?: string, search?: string, localStorage?: Storage | null }} [env]
 */
export function isPreviewOpsToolsEnabled(env = {}) {
  try {
    const hostname =
      env.hostname ??
      (typeof window !== "undefined" ? window.location.hostname : "")
    if (isVercelPreviewHost(hostname)) return true
    const search =
      env.search ??
      (typeof window !== "undefined" ? window.location.search : "")
    const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
    if (q.get("preview-ops") === "1" || q.get("pwa-debug") === "1") return true
    const ls = env.localStorage ?? (typeof window !== "undefined" ? window.localStorage : null)
    if (ls?.getItem("yds-preview-ops") === "1") return true
    if (ls?.getItem("yds-pwa-runtime-debug") === "1") return true
  } catch {
    // ignore
  }
  return false
}

/** Short git commit from buildId like `8d86b06-1793891967686` → `8d86b06` */
export function shortCommitFromBuildId(buildId) {
  const raw = String(buildId || "").trim()
  if (!raw || raw === "dev") return "dev"
  const head = raw.split("-")[0] || raw
  return head.slice(0, 8)
}
