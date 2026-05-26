export const HOME_V5_PREVIEW_PATH = "/preview/home-v5"

/** @param {string} [pathname] */
export function isHomeV5PreviewRoute(pathname = "") {
  const p = pathname || (typeof window !== "undefined" ? window.location.pathname : "")
  return p === HOME_V5_PREVIEW_PATH || p.startsWith(`${HOME_V5_PREVIEW_PATH}/`)
}
