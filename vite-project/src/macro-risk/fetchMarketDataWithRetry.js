import { fetchMarketData } from "../config/api.js"

export const MARKET_DATA_TIMEOUT_MS = 15000
export const MARKET_DATA_RETRY_DELAYS_MS = [1000, 2000, 3000]
export const MARKET_DATA_MAX_ATTEMPTS = 3

/**
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

/**
 * @param {{ cacheBust?: boolean; timeoutMs?: number }} [opts]
 */
export async function fetchMarketDataWithRetry(opts = {}) {
  const timeoutMs = opts.timeoutMs ?? MARKET_DATA_TIMEOUT_MS
  let lastError = null

  for (let attempt = 0; attempt < MARKET_DATA_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fetchMarketData({ ...opts, timeoutMs })
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      if (attempt < MARKET_DATA_MAX_ATTEMPTS - 1) {
        await sleep(MARKET_DATA_RETRY_DELAYS_MS[attempt] ?? 1000)
      }
    }
  }

  throw lastError ?? new Error("market-data: fetch failed")
}
