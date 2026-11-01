/**
 * Phase B+ — conflict hold blocks automatic re-upload after 409
 * node --test scripts/yds-portfolio-sync-conflict-hold.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it, beforeEach } from "node:test"
import {
  clearPortfolioSyncConflict,
  hasPortfolioSyncConflict,
  markPortfolioSyncConflict,
  pushCloudPortfolio,
  readPortfolioSyncMeta,
  reconcilePortfolio,
  reconcilePortfolioWithCloud,
  writePortfolioSyncMeta,
} from "../vite-project/src/content/ydsPortfolioCloudSync.js"
import {
  setActivePortfolioOwnerUid,
  writePortfolioOwnerMeta,
} from "../vite-project/src/content/ydsPortfolioStorageScope.js"

/** @type {Map<string, string>} */
let mem

function installStorage() {
  mem = new Map()
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(String(k), String(v)),
    removeItem: (k) => mem.delete(k),
  }
}

const trade = (id, at = 100) => ({
  id,
  date: "2026-01-01",
  action: "buy",
  name: "T",
  ticker: "AAPL",
  quantity: 1,
  unitPrice: 10,
  amount: 10,
  memo: "",
  createdAt: at,
  updatedAt: at,
})

beforeEach(() => {
  installStorage()
})

describe("conflict hold persistence", () => {
  it("is per-uid and survives simulated re-login metadata", () => {
    markPortfolioSyncConflict("uid-a", { serverRevision: 9 })
    assert.equal(hasPortfolioSyncConflict("uid-a"), true)
    assert.equal(hasPortfolioSyncConflict("uid-b"), false)

    writePortfolioSyncMeta("uid-b", { revision: 1, conflictPending: false })
    assert.equal(hasPortfolioSyncConflict("uid-b"), false)
    assert.equal(hasPortfolioSyncConflict("uid-a"), true)

    // A meta revision must not jump to server winner
    assert.equal(readPortfolioSyncMeta("uid-a")?.revision, null)
    assert.equal(readPortfolioSyncMeta("uid-a")?.conflictServerRevision, 9)
  })
})

describe("409 then automatic PUT", () => {
  it("blocks PUT after 409 and after local edit; reconcile does not upload", async () => {
    setActivePortfolioOwnerUid("uid-a")
    writePortfolioOwnerMeta("uid-a")
    writePortfolioSyncMeta("uid-a", { revision: 3, conflictPending: false })

    let putCount = 0
    globalThis.fetch = async (_url, init) => {
      if (init?.method === "PUT") {
        putCount += 1
        return {
          status: 409,
          ok: false,
          json: async () => ({
            error: "revision_conflict",
            revision: 4,
            portfolio: {
              trades: [trade("cloud", 200)],
              cash_balance: 0,
              revision: 4,
              updated_at: "2026-10-20T00:00:00.000Z",
            },
          }),
        }
      }
      if (init?.method === "GET") {
        return {
          status: 200,
          ok: true,
          json: async () => ({
            portfolio: {
              trades: [trade("cloud", 200)],
              cash_balance: 0,
              revision: 4,
              updated_at: "2026-10-20T00:00:00.000Z",
            },
          }),
        }
      }
      throw new Error("unexpected")
    }

    await assert.rejects(
      () => pushCloudPortfolio("tok", [trade("stale", 50)], 0, { ownerUid: "uid-a", baseRevision: 3 }),
      (e) => e && e.name === "PortfolioSyncConflictError",
    )
    assert.equal(putCount, 1)
    assert.equal(hasPortfolioSyncConflict("uid-a"), true)
    assert.equal(readPortfolioSyncMeta("uid-a")?.revision, 3, "must not advance revision to server winner")

    // Local edit must not clear conflict — second push must not hit network
    putCount = 0
    const blocked = await pushCloudPortfolio("tok", [trade("edited", 999)], 5, {
      ownerUid: "uid-a",
      baseRevision: 4,
    })
    assert.equal(blocked, null)
    assert.equal(putCount, 0)
    assert.equal(hasPortfolioSyncConflict("uid-a"), true)

    // Re-login reconcile: keep local, no PUT
    putCount = 0
    const recon = await reconcilePortfolioWithCloud("tok", [trade("edited", 999)], 5, {
      ownerUid: "uid-a",
    })
    assert.equal(recon.mode, "conflict-hold")
    assert.equal(recon.trades[0]?.id, "edited")
    assert.equal(putCount, 0)
  })

  it("healthy account without conflict still uploads", async () => {
    setActivePortfolioOwnerUid("uid-ok")
    writePortfolioOwnerMeta("uid-ok")
    writePortfolioSyncMeta("uid-ok", { revision: 2, conflictPending: false })
    clearPortfolioSyncConflict("uid-ok")

    let putCount = 0
    globalThis.fetch = async (_url, init) => {
      if (init?.method === "PUT") {
        putCount += 1
        const body = JSON.parse(String(init.body))
        assert.equal(body.baseRevision, 2)
        return {
          status: 200,
          ok: true,
          json: async () => ({
            portfolio: {
              trades: body.trades,
              cash_balance: body.cash_balance,
              revision: 3,
              updated_at: "2026-10-20T00:00:00.000Z",
            },
          }),
        }
      }
      throw new Error("unexpected GET")
    }

    const row = await pushCloudPortfolio("tok", [trade("ok")], 1, {
      ownerUid: "uid-ok",
      baseRevision: 2,
    })
    assert.ok(row)
    assert.equal(putCount, 1)
    assert.equal(hasPortfolioSyncConflict("uid-ok"), false)
    assert.equal(readPortfolioSyncMeta("uid-ok")?.revision, 3)
  })

  it("reconcilePortfolio conflictPending does not apply cloud overwrite", () => {
    const local = [trade("local", 1)]
    const cloud = {
      trades: [trade("cloud", 9)],
      cashBalance: 100,
      revision: 8,
      updatedAtMs: 9,
    }
    const r = reconcilePortfolio(local, 0, cloud, {
      knownServerRevision: 7,
      conflictPending: true,
    })
    assert.equal(r.mode, "conflict-hold")
    assert.equal(r.trades[0]?.id, "local")
  })
})
