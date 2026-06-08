/**
 * Portfolio quote cache — node scripts/yds-portfolio-quote-cache.test.mjs
 */
import { mergeQuoteWithCache } from "../vite-project/src/content/ydsPortfolioQuoteCache.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const cached = {
  price: 100,
  change: 0,
  currency: "USD",
  updatedAt: "2025-01-01T00:00:00.000Z",
  status: "live",
}

const failed = {
  price: null,
  change: null,
  currency: "USD",
  updatedAt: null,
  status: "error",
}

const fresh = {
  price: 120,
  change: 2,
  currency: "USD",
  updatedAt: "2025-06-03T00:00:00.000Z",
  status: "live",
}

const fromCache = mergeQuoteWithCache(failed, cached)
assert(fromCache?.stale === true, "stale on cache fallback")
assert(fromCache?.price === 100, "cache price")

const fromFresh = mergeQuoteWithCache(fresh, cached)
assert(fromFresh?.price === 120, "fresh wins")
assert(fromFresh?.stale !== true, "not stale")

console.log("OK portfolio quote cache")
