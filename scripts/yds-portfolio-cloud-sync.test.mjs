/**
 * Phase B — portfolio reconcile / content clock (no Date.now() LWW)
 * node scripts/yds-portfolio-cloud-sync.test.mjs
 */
import assert from "node:assert/strict"
import {
  portfolioContentUpdatedAtMs,
  portfolioRevision,
  reconcilePortfolio,
} from "../vite-project/src/content/ydsPortfolioCloudSync.js"

const trade = (id, at) => ({
  id,
  date: "2026-01-01",
  action: "buy",
  name: "Test",
  ticker: "AAPL",
  quantity: 1,
  unitPrice: 100,
  amount: 100,
  memo: "",
  createdAt: at,
  updatedAt: at,
})

const local = [trade("t1", 100)]
const cloudNewer = {
  trades: [trade("t2", 200)],
  cashBalance: 5000,
  revision: 200,
  updatedAtMs: 200,
}

const r1 = reconcilePortfolio([], 0, cloudNewer)
assert.equal(r1.source, "cloud")
assert.equal(r1.trades.length, 1)

const r2 = reconcilePortfolio(local, 0, null)
assert.equal(r2.mode, "local-only-upload-pending")

const r3 = reconcilePortfolio(local, 0, { trades: [], cashBalance: 0, revision: 0, updatedAtMs: 0 })
assert.equal(r3.mode, "local-only-upload-pending")

// Stale local vs fresher cloud — without known server rev, prefer cloud (do not overwrite).
const staleLocal = [trade("old-local", 1)]
const freshCloud = {
  trades: [trade("cloud-fresh", 1_700_000_000_000)],
  cashBalance: 9999,
  revision: 12,
  updatedAtMs: Date.now() - 60_000,
}
const rStale = reconcilePortfolio(staleLocal, 0, freshCloud, { knownServerRevision: null })
assert.equal(rStale.source, "cloud")
assert.equal(rStale.mode, "cloud-newer")
assert.equal(rStale.trades[0]?.id, "cloud-fresh")

// Cloud revision ahead of known meta → cloud wins
const rCloudAhead = reconcilePortfolio(staleLocal, 0, freshCloud, { knownServerRevision: 10 })
assert.equal(rCloudAhead.source, "cloud")
assert.equal(rCloudAhead.trades[0]?.id, "cloud-fresh")

// Same revision, local edited → local-newer (safe to upload with baseRevision)
const editedLocal = [trade("local-edit", 999)]
const cloudSameRev = {
  trades: [trade("cloud-base", 100)],
  cashBalance: 0,
  revision: 5,
  updatedAtMs: 100,
}
const rLocalEdit = reconcilePortfolio(editedLocal, 0, cloudSameRev, { knownServerRevision: 5 })
assert.equal(rLocalEdit.source, "local")
assert.equal(rLocalEdit.mode, "local-newer")

// Same revision, identical snapshot → in-sync (no upload)
const same = [trade("x", 50)]
const rSync = reconcilePortfolio(same, 100, {
  trades: same,
  cashBalance: 100,
  revision: 3,
  updatedAtMs: 50,
}, { knownServerRevision: 3 })
assert.equal(rSync.mode, "in-sync")

// Content clock must not include Date.now()
const clock = portfolioContentUpdatedAtMs([trade("a", 42)])
assert.equal(clock, 42)
assert.equal(portfolioRevision([trade("a", 42)], 9_999_999), 42)

console.log("yds-portfolio-cloud-sync.test.mjs OK")
