/**
 * KIS token globalThis cache counters — node scripts/kis-token-cache.test.mjs
 */
import {
  getKisTokenCacheStatus,
  invalidateKisTokenCache,
  isKisTokenCacheValid,
} from "../api/_lib/kisTokenManager.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

invalidateKisTokenCache("test_reset")
const fresh = getKisTokenCacheStatus()
assert(fresh.tokenIssueCount === 0, "issue count starts 0")
assert(fresh.tokenReuseCount === 0, "reuse count starts 0")
assert(!isKisTokenCacheValid(), "no cache initially")

console.log("OK kis token cache state", fresh)
