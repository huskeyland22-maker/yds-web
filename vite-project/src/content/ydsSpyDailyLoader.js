/**
 * SPY 일별 종가 (^GSPC proxy) — Event Scorecard용
 */

let cache = /** @type {Record<string, number> | null} */ (null)
let loadPromise = /** @type {Promise<Record<string, number>> | null} */ (null)

/**
 * @returns {Promise<Record<string, number>>}
 */
export async function fetchSpyDailyPrices() {
  if (cache) return cache
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    try {
      const res = await fetch("/data/spy-daily.json", { cache: "default" })
      if (!res.ok) throw new Error(`spy HTTP ${res.status}`)
      const json = await res.json()
      const prices = json?.prices && typeof json.prices === "object" ? json.prices : {}
      cache = prices
      return prices
    } catch (e) {
      console.warn("[YDS] fetchSpyDailyPrices failed", e)
      cache = {}
      return {}
    } finally {
      loadPromise = null
    }
  })()
  return loadPromise
}

/** 테스트용 */
export function resetSpyDailyCache() {
  cache = null
  loadPromise = null
}
