/**
 * Phase 6-1 — Portfolio Quote API client
 */

import {
  loadPortfolioQuoteCache,
  mergeQuoteWithCache,
  quoteCacheKey,
  savePortfolioQuoteCache,
} from "./ydsPortfolioQuoteCache.js"

/** @typedef {import("./ydsPortfolioQuoteTypes.js").PortfolioQuote} PortfolioQuote */

/**
 * @typedef {{
 *   id: string
 *   ticker?: string
 *   country?: 'us' | 'kr'
 *   priceReady?: boolean
 * }} QuoteFetchLot
 */

/**
 * @typedef {{
 *   quoteMap: Map<string, PortfolioQuote>
 *   usdkrw: number | null
 *   fetchedAt: string | null
 *   loading: boolean
 *   error: string | null
 * }} PortfolioQuoteState
 */

const REFRESH_MS = 60_000

/**
 * @param {QuoteFetchLot[]} lots
 */
export async function fetchPortfolioQuotes(lots) {
  const items = lots
    .filter((l) => l.priceReady && l.ticker)
    .map((l) => ({
      lotId: l.id,
      ticker: l.ticker,
      country: l.country === "kr" ? "kr" : "us",
    }))

  if (!items.length) {
    return { quoteMap: new Map(), usdkrw: null, fetchedAt: null, error: null }
  }

  const cache = loadPortfolioQuoteCache()
  /** @type {Record<string, PortfolioQuote>} */
  const nextCache = { ...cache }

  try {
    const res = await fetch("/api/portfolio-quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    })

    if (!res.ok) {
      throw new Error(`quote_http_${res.status}`)
    }

    const data = await res.json()
    /** @type {Map<string, PortfolioQuote>} */
    const quoteMap = new Map()

    for (const lot of lots) {
      if (!lot.priceReady || !lot.ticker) continue
      const country = lot.country === "kr" ? "kr" : "us"
      const cacheKey = quoteCacheKey(country, lot.ticker)
      const fresh = data.byLotId?.[lot.id] ?? data.quotes?.[cacheKey] ?? null
      const merged = mergeQuoteWithCache(fresh, cache[cacheKey])
      if (merged) {
        quoteMap.set(lot.id, merged)
        if (merged.price != null && merged.price > 0 && !merged.stale) {
          nextCache[cacheKey] = merged
        }
      }
    }

    savePortfolioQuoteCache(nextCache)

    return {
      quoteMap,
      usdkrw: data.usdkrw ?? null,
      fetchedAt: data.fetchedAt ?? new Date().toISOString(),
      error: null,
    }
  } catch (e) {
    /** @type {Map<string, PortfolioQuote>} */
    const quoteMap = new Map()
    for (const lot of lots) {
      if (!lot.priceReady || !lot.ticker) continue
      const country = lot.country === "kr" ? "kr" : "us"
      const cacheKey = quoteCacheKey(country, lot.ticker)
      const cached = cache[cacheKey]
      if (cached) {
        quoteMap.set(lot.id, { ...cached, status: "delayed", stale: true })
      }
    }

    return {
      quoteMap,
      usdkrw: null,
      fetchedAt: null,
      error: e instanceof Error ? e.message : "quote_fetch_failed",
    }
  }
}

export { REFRESH_MS as PORTFOLIO_QUOTE_REFRESH_MS }
