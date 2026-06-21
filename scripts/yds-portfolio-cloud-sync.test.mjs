import assert from "node:assert/strict"
import { reconcilePortfolio } from "../vite-project/src/content/ydsPortfolioCloudSync.js"

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

const r4 = reconcilePortfolio(local, 0, {
  trades: [trade("old", 50)],
  cashBalance: 0,
  revision: 50,
  updatedAtMs: 50,
})
assert.equal(r4.source, "local")
assert.equal(r4.mode, "local-newer")

console.log("yds-portfolio-cloud-sync.test.mjs OK")
