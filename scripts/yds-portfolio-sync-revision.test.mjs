/**
 * Phase B — portfolio-sync API revision / 409 (mock Supabase, no real DB writes)
 * node --test scripts/yds-portfolio-sync-revision.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { handlePortfolioSync, parseBaseRevision } from "../api/_lib/portfolioSyncHandler.js"
import {
  PortfolioSyncConflictError,
  pushCloudPortfolio,
  reconcilePortfolioWithCloud,
} from "../vite-project/src/content/ydsPortfolioCloudSync.js"
import {
  canPushPortfolioToCloud,
  setActivePortfolioOwnerUid,
  writePortfolioOwnerMeta,
} from "../vite-project/src/content/ydsPortfolioStorageScope.js"

function mockRes() {
  /** @type {{ statusCode: number, body: any }} */
  const state = { statusCode: 0, body: null }
  return {
    state,
    setHeader() {},
    status(code) {
      state.statusCode = code
      return {
        json(body) {
          state.body = body
        },
      }
    },
  }
}

const trade = (id) => ({
  id,
  date: "2026-01-01",
  action: "buy",
  name: "T",
  ticker: "AAPL",
  quantity: 1,
  unitPrice: 10,
  amount: 10,
  memo: "",
  createdAt: 100,
  updatedAt: 100,
})

describe("parseBaseRevision", () => {
  it("treats null/empty as create base", () => {
    assert.equal(parseBaseRevision(null), null)
    assert.equal(parseBaseRevision(""), null)
    assert.equal(parseBaseRevision(0), 0)
    assert.equal(parseBaseRevision("7"), 7)
  })
})

describe("portfolio-sync PUT revision", () => {
  it("local change vs unchanged cloud — upload succeeds and increments revision", async () => {
    /** @type {any} */
    let row = {
      firebase_uid: "uid-a",
      trades: [trade("old")],
      cash_balance: 0,
      revision: 5,
      updated_at: "2026-10-20T00:00:00.000Z",
    }
    const res = mockRes()
    await handlePortfolioSync(
      {
        method: "PUT",
        headers: { authorization: "Bearer t" },
        body: { trades: [trade("new")], cash_balance: 10, baseRevision: 5 },
      },
      res,
      {
        verifyFirebaseIdToken: async () => "uid-a",
        isSupabaseConfigured: () => true,
        supabaseRest: async (path, opts = {}) => {
          if (opts.method === "GET") return [row]
          if (opts.method === "PATCH") {
            assert.match(path, /revision=eq\.5/)
            row = {
              ...row,
              trades: opts.body.trades,
              cash_balance: opts.body.cash_balance,
              revision: opts.body.revision,
            }
            assert.equal(row.revision, 6)
            return [row]
          }
          throw new Error(`unexpected ${opts.method} ${path}`)
        },
      },
    )
    assert.equal(res.state.statusCode, 200)
    assert.equal(res.state.body.portfolio.revision, 6)
    assert.equal(res.state.body.portfolio.trades[0].id, "new")
  })

  it("baseRevision mismatch → 409 and server row unchanged", async () => {
    const row = {
      firebase_uid: "uid-a",
      trades: [trade("server")],
      cash_balance: 50,
      revision: 9,
      updated_at: "2026-10-20T00:00:00.000Z",
    }
    let patchCalls = 0
    const res = mockRes()
    await handlePortfolioSync(
      {
        method: "PUT",
        headers: { authorization: "Bearer t" },
        body: { trades: [trade("stale")], cash_balance: 0, baseRevision: 7 },
      },
      res,
      {
        verifyFirebaseIdToken: async () => "uid-a",
        isSupabaseConfigured: () => true,
        supabaseRest: async (_path, opts = {}) => {
          if (opts.method === "GET") return [row]
          if (opts.method === "PATCH") {
            patchCalls += 1
            return [row]
          }
          return []
        },
      },
    )
    assert.equal(res.state.statusCode, 409)
    assert.equal(res.state.body.error, "revision_conflict")
    assert.equal(res.state.body.revision, 9)
    assert.equal(res.state.body.portfolio.trades[0].id, "server")
    assert.equal(patchCalls, 0)
  })

  it("concurrent create — second INSERT conflict returns 409", async () => {
    let created = false
    /** @type {any} */
    let row = null
    const first = mockRes()
    const deps = {
      verifyFirebaseIdToken: async () => "uid-a",
      isSupabaseConfigured: () => true,
      supabaseRest: async (path, opts = {}) => {
        if (opts.method === "GET") return row ? [row] : []
        if (opts.method === "POST" && path === "user_portfolio") {
          if (created) {
            throw new Error("Supabase 409: duplicate key value violates unique constraint")
          }
          created = true
          row = {
            firebase_uid: "uid-a",
            trades: opts.body.trades,
            cash_balance: opts.body.cash_balance,
            revision: 1,
            updated_at: "2026-10-20T01:00:00.000Z",
          }
          return [row]
        }
        throw new Error(`unexpected ${opts.method}`)
      },
    }

    await handlePortfolioSync(
      {
        method: "PUT",
        headers: { authorization: "Bearer t" },
        body: { trades: [trade("a")], cash_balance: 1, baseRevision: null },
      },
      first,
      deps,
    )
    assert.equal(first.state.statusCode, 200)
    assert.equal(first.state.body.portfolio.revision, 1)

    const second = mockRes()
    // Simulate race: GET still empty from second writer's POV before noticing winner…
    // Our handler GETs first; after first create, GET returns row → update path needs baseRevision.
    // True concurrent create: both see empty. Reset for second call by using a store that flips after first POST.
    let getEmptyOnce = true
    const raceDeps = {
      verifyFirebaseIdToken: async () => "uid-a",
      isSupabaseConfigured: () => true,
      supabaseRest: async (path, opts = {}) => {
        if (opts.method === "GET") {
          if (getEmptyOnce) {
            getEmptyOnce = false
            return []
          }
          return [
            {
              firebase_uid: "uid-a",
              trades: [trade("winner")],
              cash_balance: 0,
              revision: 1,
              updated_at: "2026-10-20T01:00:00.000Z",
            },
          ]
        }
        if (opts.method === "POST") {
          throw new Error("Supabase 409: duplicate key")
        }
        return []
      },
    }
    await handlePortfolioSync(
      {
        method: "PUT",
        headers: { authorization: "Bearer t" },
        body: { trades: [trade("loser")], cash_balance: 2, baseRevision: null },
      },
      second,
      raceDeps,
    )
    assert.equal(second.state.statusCode, 409)
    assert.equal(second.state.body.error, "revision_conflict")
    assert.equal(second.state.body.message, "create_race")
    assert.equal(second.state.body.portfolio.trades[0].id, "winner")
  })

  it("PATCH race (0 rows) → 409 without applying body", async () => {
    const row = {
      firebase_uid: "uid-a",
      trades: [trade("keep")],
      cash_balance: 1,
      revision: 3,
      updated_at: "2026-10-20T00:00:00.000Z",
    }
    const res = mockRes()
    await handlePortfolioSync(
      {
        method: "PUT",
        headers: { authorization: "Bearer t" },
        body: { trades: [trade("lost")], cash_balance: 0, baseRevision: 3 },
      },
      res,
      {
        verifyFirebaseIdToken: async () => "uid-a",
        isSupabaseConfigured: () => true,
        supabaseRest: async (_path, opts = {}) => {
          if (opts.method === "GET") return [row]
          if (opts.method === "PATCH") return [] // lost optimistic lock
          return []
        },
      },
    )
    assert.equal(res.state.statusCode, 409)
    assert.equal(res.state.body.message, "patch_race")
    assert.equal(res.state.body.portfolio.trades[0].id, "keep")
  })
})

describe("client conflict + Phase A owner guard", () => {
  it("409 does not auto-retry PUT; owner mismatch still blocks", async () => {
    /** @type {Map<string, string>} */
    const mem = new Map()
    globalThis.localStorage = {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(String(k), String(v)),
      removeItem: (k) => mem.delete(k),
    }

    setActivePortfolioOwnerUid("uid-b")
    writePortfolioOwnerMeta("uid-b")
    assert.equal(canPushPortfolioToCloud("uid-b"), true)

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
              firebase_uid: "uid-b",
              trades: [trade("cloud")],
              cash_balance: 0,
              revision: 4,
              updated_at: "2026-10-20T00:00:00.000Z",
            },
          }),
        }
      }
      return { status: 200, ok: true, json: async () => ({ portfolio: null }) }
    }

    await assert.rejects(
      () => pushCloudPortfolio("tok", [trade("local")], 0, { ownerUid: "uid-b", baseRevision: 3 }),
      (err) => err instanceof PortfolioSyncConflictError,
    )
    assert.equal(putCount, 1)

    writePortfolioOwnerMeta("uid-a")
    putCount = 0
    const blocked = await pushCloudPortfolio("tok", [trade("local")], 0, {
      ownerUid: "uid-b",
      baseRevision: 3,
    })
    assert.equal(blocked, null)
    assert.equal(putCount, 0)

    // Reconcile with missing ownerUid still skips upload (Phase A)
    putCount = 0
    globalThis.fetch = async (_url, init) => {
      if (init?.method === "GET") {
        return { status: 200, ok: true, json: async () => ({ portfolio: null }) }
      }
      putCount += 1
      throw new Error("PUT should not run")
    }
    const recon = await reconcilePortfolioWithCloud("tok", [trade("x")], 1, {})
    assert.equal(recon.mode, "local-only-upload-pending")
    assert.equal(putCount, 0)
  })
})
