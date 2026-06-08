/**
 * Phase 6-1 — 마지막 성공 시세 캐시 (localStorage)
 */

const CACHE_KEY = "yds-portfolio-quotes-cache-v1"

/**
 * @typedef {import("./ydsPortfolioQuoteTypes.js").PortfolioQuote} PortfolioQuote
 */

/**
 * @param {'us' | 'kr'} country
 * @param {string} ticker
 */
export function quoteCacheKey(country, ticker) {
  return `${country}:${String(ticker ?? "").trim()}`
}

/** @returns {Record<string, PortfolioQuote>} */
export function loadPortfolioQuoteCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

/** @param {Record<string, PortfolioQuote>} cache */
export function savePortfolioQuoteCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    /* ignore */
  }
}

/**
 * @param {PortfolioQuote | null | undefined} fresh
 * @param {PortfolioQuote | null | undefined} cached
 * @returns {PortfolioQuote | null}
 */
export function mergeQuoteWithCache(fresh, cached) {
  if (fresh?.price != null && fresh.price > 0 && fresh.status !== "error") {
    return { ...fresh, stale: false }
  }
  if (cached?.price != null && cached.price > 0) {
    return { ...cached, status: "delayed", stale: true }
  }
  if (fresh?.price != null && fresh.price > 0) return fresh
  return fresh ?? cached ?? null
}
