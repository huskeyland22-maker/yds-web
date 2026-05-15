const PREFIX = "yds-stock-snap:"

function key(code) {
  return `${PREFIX}${String(code).replace(/\D/g, "").padStart(6, "0")}`
}

/** @param {string} code @param {object} snap */
export function saveStockSnapCache(code, snap) {
  if (typeof window === "undefined" || !code || !snap?.chart) return
  try {
    const payload = {
      savedAt: Date.now(),
      snap,
    }
    sessionStorage.setItem(key(code), JSON.stringify(payload))
  } catch {
    /* quota */
  }
}

/** @param {string} code */
export function readStockSnapCache(code) {
  if (typeof window === "undefined" || !code) return null
  try {
    const raw = sessionStorage.getItem(key(code))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.snap?.chart) return null
    return parsed
  } catch {
    return null
  }
}
