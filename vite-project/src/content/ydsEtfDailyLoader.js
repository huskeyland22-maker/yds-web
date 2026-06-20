/**
 * ETF 일별 종가 — Panic Lab 성과 검증용
 */

/** @typedef {'SPY' | 'QQQ' | 'SOXX'} EtfBenchmarkId */

/** @type {Record<EtfBenchmarkId, string>} */
const ETF_FILES = {
  SPY: "/data/spy-daily.json",
  QQQ: "/data/qqq-daily.json",
  SOXX: "/data/soxx-daily.json",
}

/** @type {Partial<Record<EtfBenchmarkId, Record<string, number>>>} */
const cache = {}

/** @type {Partial<Record<EtfBenchmarkId, Promise<Record<string, number>>>>} */
const loadPromises = {}

/**
 * @param {EtfBenchmarkId} id
 * @returns {Promise<Record<string, number>>}
 */
export async function fetchEtfDailyPrices(id) {
  if (cache[id]) return cache[id]
  if (loadPromises[id]) return loadPromises[id]

  const file = ETF_FILES[id]
  loadPromises[id] = (async () => {
    try {
      const res = await fetch(file, { cache: "default" })
      if (!res.ok) throw new Error(`${id} HTTP ${res.status}`)
      const json = await res.json()
      const prices = json?.prices && typeof json.prices === "object" ? json.prices : {}
      cache[id] = prices
      return prices
    } catch (e) {
      console.warn(`[YDS] fetchEtfDailyPrices(${id}) failed`, e)
      cache[id] = {}
      return {}
    } finally {
      delete loadPromises[id]
    }
  })()

  return loadPromises[id]
}

/** @returns {Promise<Record<EtfBenchmarkId, Record<string, number>>>} */
export async function fetchPanicLabBenchmarks() {
  const ids = /** @type {EtfBenchmarkId[]} */ (["SPY", "QQQ", "SOXX"])
  const entries = await Promise.all(ids.map(async (id) => [id, await fetchEtfDailyPrices(id)]))
  return Object.fromEntries(entries)
}

/** 테스트용 */
export function resetEtfDailyCache() {
  for (const key of Object.keys(cache)) delete cache[key]
}
