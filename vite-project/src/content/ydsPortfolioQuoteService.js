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

/** @returns {PortfolioQuoteState} */
function emptyQuoteResult(error = null) {
  return { quoteMap: new Map(), usdkrw: null, fetchedAt: null, loading: false, error }
}

/**
 * @param {QuoteFetchLot[]} lots
 * @param {Record<string, PortfolioQuote>} cache
 */
function quoteMapFromCache(lots, cache) {
  /** @type {Map<string, PortfolioQuote>} */
  const quoteMap = new Map()
  for (const lot of lots ?? []) {
    if (!lot?.priceReady || !lot.ticker) continue
    const country = lot.country === "kr" ? "kr" : "us"
    const cacheKey = quoteCacheKey(country, lot.ticker)
    const cached = cache?.[cacheKey]
    if (cached?.price != null && cached.price > 0) {
      quoteMap.set(lot.id, { ...cached, status: "delayed", stale: true })
    }
  }
  return quoteMap
}

/**
 * @param {QuoteFetchLot[]} lots
 */
export async function fetchPortfolioQuotes(lots) {
  const safeLots = Array.isArray(lots) ? lots : []

  const items = safeLots
    .filter((l) => l?.priceReady && l.ticker)
    .map((l) => ({
      lotId: l.id,
      ticker: l.ticker,
      country: l.country === "kr" ? "kr" : "us",
    }))

  if (!items.length) {
    return emptyQuoteResult()
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

    let data = {}
    try {
      data = await res.json()
    } catch {
      throw new Error("quote_json_invalid")
    }
    if (!data || typeof data !== "object") {
      throw new Error("quote_payload_invalid")
    }

    const byLotId = data.byLotId && typeof data.byLotId === "object" ? data.byLotId : {}
    const quotes = data.quotes && typeof data.quotes === "object" ? data.quotes : {}

    /** @type {Map<string, PortfolioQuote>} */
    const quoteMap = new Map()

    for (const lot of safeLots) {
      if (!lot?.priceReady || !lot.ticker) continue
      const country = lot.country === "kr" ? "kr" : "us"
      const cacheKey = quoteCacheKey(country, lot.ticker)
      const fresh = byLotId[lot.id] ?? quotes[cacheKey] ?? null
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
      loading: false,
      error: null,
    }
  } catch (e) {
    return {
      quoteMap: quoteMapFromCache(safeLots, cache),
      usdkrw: null,
      fetchedAt: null,
      loading: false,
      error: e instanceof Error ? e.message : "quote_fetch_failed",
    }
  }
}

export { REFRESH_MS as PORTFOLIO_QUOTE_REFRESH_MS }
