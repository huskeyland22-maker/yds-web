export const HOME_V5_VALIDATION_PATH = "/preview/home-v5-validation"

/** @param {string} [pathname] */
export function isHomeV5ValidationRoute(pathname = "") {
  const p = pathname || (typeof window !== "undefined" ? window.location.pathname : "")
  return p === HOME_V5_VALIDATION_PATH || p.startsWith(`${HOME_V5_VALIDATION_PATH}/`)
}
