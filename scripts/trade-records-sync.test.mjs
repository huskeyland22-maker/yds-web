/**
 * Mock tests for /api/trade-records-sync (handleTradeRecordsSync).
 * No production Supabase writes.
 * node --test scripts/trade-records-sync.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  handleTradeRecordsSync,
  sanitizeTradeRecordsStore,
} from "../api/_lib/tradeRecordsSyncHandler.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

const SAMPLE_STORE = {
  version: 1,
  records: {
    "dbb:ITA": [
      {
        id: "tr_1790150771847_c389dv",
        system: "dbb",
        symbol: "ITA",
        buyDate: "2026-09-22",
        buyPrice: 216.17,
        buyAmountUsd: 1080,
        shares: 5,
        weightPct: 50,
        memo: "",
        createdAt: "2026-09-23T08:06:11.847Z",
        updatedAt: "2026-09-23T08:06:11.847Z",
      },
    ],
  },
}

function mockRes() {
  /** @type {{ statusCode: number, body: any, headers: Record<string, string> }} */
  const state = { statusCode: 0, body: null, headers: {} }
  return {
    state,
    setHeader(k, v) {
      state.headers[k] = v
    },
    status(code) {
      state.statusCode = code
      return this
    },
    json(body) {
      state.body = body
      return this
    },
  }
}

describe("sanitizeTradeRecordsStore", () => {
  it("preserves existing trade record JSON structure", () => {
    const out = sanitizeTradeRecordsStore(SAMPLE_STORE)
    assert.equal(out.version, 1)
    assert.ok(out.records["dbb:ITA"])
    assert.equal(out.records["dbb:ITA"][0].symbol, "ITA")
    assert.equal(out.records["dbb:ITA"][0].weightPct, 50)
    assert.equal(out.records["dbb:ITA"][0].buyAmountUsd, 1080)
    assert.equal(out.records["dbb:ITA"][0].shares, 5)
  })

  it("drops invalid buckets / rows without id", () => {
    const out = sanitizeTradeRecordsStore({
      version: 1,
      records: {
        "dbb:QQQ": [{ buyPrice: 1 }],
        "dbb:ITA": [SAMPLE_STORE.records["dbb:ITA"][0]],
      },
    })
    assert.equal(Object.keys(out.records).join(","), "dbb:ITA")
  })
})

describe("trade-records-sync auth", () => {
  it("GET without Firebase token → 401", async () => {
    const res = mockRes()
    await handleTradeRecordsSync(
      { method: "GET", headers: {}, body: {} },
      res,
      {
        verifyFirebaseIdToken: async () => {
          throw new Error("should_not_run")
        },
        isSupabaseConfigured: () => true,
        supabaseRest: async () => {
          throw new Error("should_not_run")
        },
      },
    )
    assert.equal(res.state.statusCode, 401)
    assert.equal(res.state.body?.error, "missing_token")
  })

  it("PUT without Firebase token → 401", async () => {
    const res = mockRes()
    await handleTradeRecordsSync(
      { method: "PUT", headers: {}, body: { records: SAMPLE_STORE } },
      res,
      {
        verifyFirebaseIdToken: async () => "uid-a",
        isSupabaseConfigured: () => true,
        supabaseRest: async () => [],
      },
    )
    assert.equal(res.state.statusCode, 401)
    assert.equal(res.state.body?.error, "missing_token")
  })

  it("invalid token → 401", async () => {
    const res = mockRes()
    await handleTradeRecordsSync(
      { method: "GET", headers: { authorization: "Bearer bad" }, body: {} },
      res,
      {
        verifyFirebaseIdToken: async () => {
          throw new Error("token_lookup_failed")
        },
        isSupabaseConfigured: () => true,
        supabaseRest: async () => [],
      },
    )
    assert.equal(res.state.statusCode, 401)
    assert.equal(res.state.body?.error, "invalid_token")
  })
})

describe("trade-records-sync CRUD (mock)", () => {
  it("valid token GET → user records", async () => {
    const res = mockRes()
    await handleTradeRecordsSync(
      { method: "GET", headers: { authorization: "Bearer good" }, body: {} },
      res,
      {
        verifyFirebaseIdToken: async (t) => {
          assert.equal(t, "good")
          return "uid-alice"
        },
        isSupabaseConfigured: () => true,
        supabaseRest: async (path) => {
          assert.match(path, /firebase_uid=eq\.uid-alice/)
          assert.ok(!path.includes("uid-bob"))
          return [
            {
              id: "row-1",
              firebase_uid: "uid-alice",
              records: SAMPLE_STORE,
              revision: 42,
              updated_at: "2026-09-26T00:00:00.000Z",
            },
          ]
        },
      },
    )
    assert.equal(res.state.statusCode, 200)
    assert.equal(res.state.body.syncMode, "account")
    assert.equal(res.state.body.revision, 42)
    assert.equal(res.state.body.records.records["dbb:ITA"][0].weightPct, 50)
  })

  it("PUT upserts for token UID and ignores body.firebase_uid", async () => {
    /** @type {object[]} */
    const calls = []
    const res = mockRes()
    await handleTradeRecordsSync(
      {
        method: "PUT",
        headers: { authorization: "Bearer good" },
        body: {
          firebase_uid: "uid-attacker",
          records: SAMPLE_STORE,
          revision: 100,
        },
      },
      res,
      {
        verifyFirebaseIdToken: async () => "uid-alice",
        isSupabaseConfigured: () => true,
        supabaseRest: async (path, opts = {}) => {
          calls.push({ path, opts })
          assert.ok(!path.includes("uid-attacker"))
          if (opts.method === "POST") {
            assert.equal(opts.body.firebase_uid, "uid-alice")
            assert.equal(opts.body.revision, 100)
            assert.equal(opts.body.records.records["dbb:ITA"][0].symbol, "ITA")
            return [
              {
                id: "row-1",
                firebase_uid: "uid-alice",
                records: opts.body.records,
                revision: 100,
                updated_at: "2026-09-26T01:00:00.000Z",
              },
            ]
          }
          return []
        },
      },
    )
    assert.equal(res.state.statusCode, 200)
    assert.equal(res.state.body.revision, 100)
    assert.equal(res.state.body.syncMode, "account")
    const post = calls.find((c) => c.opts.method === "POST")
    assert.ok(post)
    assert.match(post.path, /on_conflict=firebase_uid/)
  })

  it("same UID PUT again updates existing row", async () => {
    let postCount = 0
    const res = mockRes()
    await handleTradeRecordsSync(
      {
        method: "PUT",
        headers: { authorization: "Bearer good" },
        body: { records: SAMPLE_STORE, revision: 200 },
      },
      res,
      {
        verifyFirebaseIdToken: async () => "uid-alice",
        isSupabaseConfigured: () => true,
        supabaseRest: async (path, opts = {}) => {
          if (opts.method === "POST") {
            postCount += 1
            assert.match(path, /user_trade_records\?on_conflict=firebase_uid/)
            return [
              {
                id: "row-1",
                firebase_uid: "uid-alice",
                records: SAMPLE_STORE,
                revision: 200,
                updated_at: "2026-09-26T02:00:00.000Z",
              },
            ]
          }
          return []
        },
      },
    )
    assert.equal(res.state.statusCode, 200)
    assert.equal(postCount, 1)
    assert.equal(res.state.body.revision, 200)
  })

  it("cannot access another UID's data via query path", async () => {
    const res = mockRes()
    await handleTradeRecordsSync(
      { method: "GET", headers: { authorization: "Bearer good" }, body: {} },
      res,
      {
        verifyFirebaseIdToken: async () => "uid-alice",
        isSupabaseConfigured: () => true,
        // Simulate misconfigured DB returning wrong uid — handler must forbid
        supabaseRest: async () => [
          {
            id: "row-x",
            firebase_uid: "uid-bob",
            records: SAMPLE_STORE,
            revision: 1,
            updated_at: "2026-09-26T00:00:00.000Z",
          },
        ],
      },
    )
    assert.equal(res.state.statusCode, 403)
    assert.equal(res.state.body?.error, "forbidden")
  })

  it("revision conflict when baseRevision mismatches", async () => {
    const res = mockRes()
    await handleTradeRecordsSync(
      {
        method: "PUT",
        headers: { authorization: "Bearer good" },
        body: { records: SAMPLE_STORE, revision: 3, baseRevision: 1 },
      },
      res,
      {
        verifyFirebaseIdToken: async () => "uid-alice",
        isSupabaseConfigured: () => true,
        supabaseRest: async (path, opts = {}) => {
          if (opts.method === "GET" || !opts.method) {
            return [{ firebase_uid: "uid-alice", revision: 2 }]
          }
          throw new Error("should_not_upsert")
        },
      },
    )
    assert.equal(res.state.statusCode, 409)
    assert.equal(res.state.body?.error, "revision_conflict")
    assert.equal(res.state.body?.revision, 2)
  })
})

describe("trade-records-sync wiring", () => {
  it("vercel rewrite maps /api/trade-records-sync → portfolio-sync?ydsMode=trade-records", () => {
    const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"))
    const hit = vercel.rewrites?.find((r) => r.source === "/api/trade-records-sync")
    assert.ok(hit, "missing trade-records-sync rewrite")
    assert.equal(hit.destination, "/api/portfolio-sync?ydsMode=trade-records")
  })

  it("portfolio-sync early-dispatches trade-records mode", async () => {
    const { default: portfolioHandler } = await import("../api/portfolio-sync.js")
    const res = mockRes()
    await portfolioHandler(
      {
        method: "GET",
        query: { ydsMode: "trade-records" },
        headers: {},
        body: {},
      },
      res,
    )
    // missing token handled by trade-records handler (not portfolio missing_token path alone)
    assert.equal(res.state.statusCode, 401)
    assert.equal(res.state.body?.error, "missing_token")
  })

  it("migration defines user_trade_records", () => {
    const sql = readFileSync(
      join(root, "supabase/migrations/20250926120000_user_trade_records.sql"),
      "utf8",
    )
    assert.match(sql, /create table if not exists public\.user_trade_records/)
    assert.match(sql, /firebase_uid text not null unique/)
    assert.match(sql, /records jsonb/)
    assert.match(sql, /revision bigint/)
  })
})
