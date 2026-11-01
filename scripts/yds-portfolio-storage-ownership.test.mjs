/**
 * Phase A — portfolio localStorage ownership / key isolation
 * node scripts/yds-portfolio-storage-ownership.test.mjs
 */
import assert from "node:assert/strict"
import {
  canPushPortfolioToCloud,
  getActivePortfolioOwnerUid,
  peekSharedPortfolioCashRaw,
  peekSharedPortfolioTradesRaw,
  portfolioCashKeyForOwner,
  portfolioTradesKeyForOwner,
  readPortfolioOwnerMeta,
  setActivePortfolioOwnerUid,
  writePortfolioOwnerMeta,
} from "../vite-project/src/content/ydsPortfolioStorageScope.js"
import {
  loadPortfolioTradesForOwner,
  savePortfolioTradesForOwner,
} from "../vite-project/src/content/ydsPortfolioTradesStorage.js"
import {
  loadCashBalanceForOwner,
  saveCashBalanceForOwner,
} from "../vite-project/src/content/ydsPortfolioCashBalanceStorage.js"
import {
  pushCloudPortfolio,
  reconcilePortfolioWithCloud,
} from "../vite-project/src/content/ydsPortfolioCloudSync.js"

/** @type {Map<string, string>} */
const mem = new Map()

globalThis.localStorage = {
  getItem(key) {
    return mem.has(key) ? mem.get(key) : null
  },
  setItem(key, value) {
    mem.set(String(key), String(value))
  },
  removeItem(key) {
    mem.delete(String(key))
  },
  clear() {
    mem.clear()
  },
  key(i) {
    return [...mem.keys()][i] ?? null
  },
  get length() {
    return mem.size
  },
}

const SHARED_TRADES = "yds-portfolio-trades-v1"
const SHARED_CASH = "yds-portfolio-cash-balance-v1"

function trade(id, ticker = "AAPL") {
  const now = 1_700_000_000_000
  return {
    id,
    date: "2026-01-01",
    action: "buy",
    name: "Test",
    ticker,
    quantity: 1,
    unitPrice: 100,
    amount: 100,
    memo: "",
    createdAt: now,
    updatedAt: now,
  }
}

// --- A/B key separation ---
assert.equal(portfolioTradesKeyForOwner(null), `${SHARED_TRADES}:guest`)
assert.equal(portfolioTradesKeyForOwner("uid-a"), `${SHARED_TRADES}:uid:uid-a`)
assert.equal(portfolioTradesKeyForOwner("uid-b"), `${SHARED_TRADES}:uid:uid-b`)
assert.notEqual(portfolioTradesKeyForOwner("uid-a"), portfolioTradesKeyForOwner("uid-b"))
assert.equal(portfolioCashKeyForOwner("uid-a"), `${SHARED_CASH}:uid:uid-a`)

savePortfolioTradesForOwner("uid-a", [trade("a1")])
saveCashBalanceForOwner("uid-a", 111)
savePortfolioTradesForOwner("uid-b", [trade("b1", "MSFT")])
saveCashBalanceForOwner("uid-b", 222)

assert.equal(loadPortfolioTradesForOwner("uid-a")[0]?.id, "a1")
assert.equal(loadPortfolioTradesForOwner("uid-b")[0]?.id, "b1")
assert.equal(loadCashBalanceForOwner("uid-a"), 111)
assert.equal(loadCashBalanceForOwner("uid-b"), 222)

// Shared orphan preserved — never written by scoped save
mem.set(SHARED_TRADES, JSON.stringify([trade("orphan")]))
mem.set(SHARED_CASH, JSON.stringify(999))
assert.equal(peekSharedPortfolioTradesRaw()?.includes("orphan"), true)
assert.equal(Number(JSON.parse(peekSharedPortfolioCashRaw())), 999)

savePortfolioTradesForOwner("uid-a", [trade("a2")])
assert.equal(peekSharedPortfolioTradesRaw()?.includes("orphan"), true, "shared trades must stay intact")
assert.equal(Number(JSON.parse(peekSharedPortfolioCashRaw())), 999, "shared cash must stay intact")

// Loading account A must not surface orphan or B
assert.equal(loadPortfolioTradesForOwner("uid-a")[0]?.id, "a2")
assert.equal(loadPortfolioTradesForOwner("uid-a").some((t) => t.id === "orphan"), false)
assert.equal(loadPortfolioTradesForOwner("uid-a").some((t) => t.id === "b1"), false)

// B login simulation: active scope B — A data not in B slot
setActivePortfolioOwnerUid("uid-b")
writePortfolioOwnerMeta("uid-b")
const bView = loadPortfolioTradesForOwner("uid-b")
assert.equal(bView[0]?.id, "b1")
assert.equal(bView.some((t) => t.id === "a2"), false)

// Owner mismatch / missing → cloud PUT blocked
let fetchCalls = 0
globalThis.fetch = async () => {
  fetchCalls += 1
  return {
    status: 200,
    ok: true,
    json: async () => ({ portfolio: { revision: 1, updated_at: Date.now(), trades: [], cash_balance: 0 } }),
  }
}

writePortfolioOwnerMeta(null) // guest
assert.equal(canPushPortfolioToCloud("uid-b"), false)
const blockedGuest = await pushCloudPortfolio("token", bView, 222, { ownerUid: "uid-b" })
assert.equal(blockedGuest, null)
assert.equal(fetchCalls, 0)

writePortfolioOwnerMeta("uid-a") // A owns meta while pushing as B
assert.equal(canPushPortfolioToCloud("uid-b"), false)
const blockedMismatch = await pushCloudPortfolio("token", bView, 222, { ownerUid: "uid-b" })
assert.equal(blockedMismatch, null)
assert.equal(fetchCalls, 0)

// Unowned shared data must not auto-upload via reconcile
setActivePortfolioOwnerUid("uid-b")
writePortfolioOwnerMeta("uid-b")
const orphanTrades = [trade("orphan")]
// Simulate mistaken attempt: reconcile with orphan payload but owner guard uses meta —
// even local-newer with data requires matching owner — meta is B, ownerUid B → would upload.
// Explicit test: ownerUid missing → no upload
fetchCalls = 0
globalThis.fetch = async (url, init) => {
  fetchCalls += 1
  if (init?.method === "GET") {
    return {
      status: 200,
      ok: true,
      json: async () => ({ portfolio: null }),
    }
  }
  throw new Error("unexpected PUT")
}
const reconNoOwner = await reconcilePortfolioWithCloud("token", orphanTrades, 999, {})
assert.equal(reconNoOwner.mode, "local-only-upload-pending")
assert.equal(fetchCalls, 1, "GET only — PUT blocked without ownerUid")

// Shared orphan still present after all of the above
assert.equal(peekSharedPortfolioTradesRaw()?.includes("orphan"), true)

// Logout: switch to guest — A slot preserved
savePortfolioTradesForOwner("uid-a", [trade("a-keep")])
setActivePortfolioOwnerUid(null)
writePortfolioOwnerMeta(null)
assert.equal(loadPortfolioTradesForOwner("uid-a")[0]?.id, "a-keep")
assert.equal(loadPortfolioTradesForOwner(null).length, 0)
assert.deepEqual(readPortfolioOwnerMeta()?.kind, "guest")
assert.equal(getActivePortfolioOwnerUid(), null)

console.log("yds-portfolio-storage-ownership.test.mjs OK")
