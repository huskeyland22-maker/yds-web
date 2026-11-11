/**
 * Mock tests for me-membership hosted on portfolio-sync (Hobby function cap).
 * No production Supabase writes.
 * node --test scripts/me-membership-dispatch.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { handleMeMembership } from "../api/_lib/meMembershipHandler.js"
import { MembershipLookupError } from "../api/_lib/userMembership.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

function mockRes() {
  const state = { statusCode: 200, body: null, headers: {} }
  const api = {
    state,
    setHeader(k, v) {
      state.headers[k] = v
    },
    status(code) {
      state.statusCode = code
      return {
        json(body) {
          state.body = body
        },
      }
    },
  }
  return api
}

describe("handleMeMembership", () => {
  it("missing token → 401 missing_token", async () => {
    const res = mockRes()
    await handleMeMembership({ method: "GET", headers: {} }, res, {
      verifyFirebaseIdToken: async () => {
        throw new Error("should_not_run")
      },
    })
    assert.equal(res.state.statusCode, 401)
    assert.equal(res.state.body?.error, "missing_token")
  })

  it("invalid token → 401 invalid_token", async () => {
    const res = mockRes()
    await handleMeMembership(
      { method: "GET", headers: { authorization: "Bearer bad-token" } },
      res,
      {
        verifyFirebaseIdToken: async () => {
          throw new Error("token_expired")
        },
      },
    )
    assert.equal(res.state.statusCode, 401)
    assert.equal(res.state.body?.error, "invalid_token")
  })

  it("POST → 405 method_not_allowed", async () => {
    const res = mockRes()
    await handleMeMembership({ method: "POST", headers: { authorization: "Bearer x" } }, res, {
      verifyFirebaseIdToken: async () => "uid",
    })
    assert.equal(res.state.statusCode, 405)
    assert.equal(res.state.body?.error, "method_not_allowed")
    assert.equal(res.state.headers.Allow, "GET")
  })

  it("success keeps response shape", async () => {
    const res = mockRes()
    await handleMeMembership(
      { method: "GET", headers: { authorization: "Bearer good" } },
      res,
      {
        verifyFirebaseIdToken: async () => "firebase-uid-1",
        resolveUserMembership: async (uid) => {
          assert.equal(uid, "firebase-uid-1")
          return {
            plan: "pro",
            status: "active",
            source: "manual",
            updatedAt: "2026-11-02T00:00:00.000Z",
            reason: "plan_pro",
          }
        },
      },
    )
    assert.equal(res.state.statusCode, 200)
    assert.deepEqual(res.state.body, {
      plan: "pro",
      status: "active",
      source: "manual",
      updatedAt: "2026-11-02T00:00:00.000Z",
      reason: "plan_pro",
      audience: "pro",
      detailAccess: true,
    })
  })

  it("supabase_not_configured → 503", async () => {
    const res = mockRes()
    await handleMeMembership(
      { method: "GET", headers: { authorization: "Bearer good" } },
      res,
      {
        verifyFirebaseIdToken: async () => "uid",
        resolveUserMembership: async () => {
          throw new MembershipLookupError("supabase_not_configured", "missing")
        },
      },
    )
    assert.equal(res.state.statusCode, 503)
    assert.equal(res.state.body?.error, "supabase_not_configured")
  })
})

describe("me-membership wiring", () => {
  it("vercel rewrite maps /api/me-membership → portfolio-sync?ydsMode=me-membership", () => {
    const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"))
    const hit = vercel.rewrites?.find((r) => r.source === "/api/me-membership")
    assert.ok(hit, "missing me-membership rewrite")
    assert.equal(hit.destination, "/api/portfolio-sync?ydsMode=me-membership")
  })

  it("keeps trade-records rewrite intact", () => {
    const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"))
    const hit = vercel.rewrites?.find((r) => r.source === "/api/trade-records-sync")
    assert.ok(hit)
    assert.equal(hit.destination, "/api/portfolio-sync?ydsMode=trade-records")
  })

  it("portfolio-sync early-dispatches me-membership mode", async () => {
    const { default: portfolioHandler } = await import("../api/portfolio-sync.js")
    const res = mockRes()
    await portfolioHandler(
      {
        method: "GET",
        query: { ydsMode: "me-membership" },
        headers: {},
        body: {},
      },
      res,
    )
    assert.equal(res.state.statusCode, 401)
    assert.equal(res.state.body?.error, "missing_token")
  })

  it("portfolio-sync without ydsMode stays on portfolio path (missing_token)", async () => {
    const { default: portfolioHandler } = await import("../api/portfolio-sync.js")
    const res = mockRes()
    await portfolioHandler(
      {
        method: "GET",
        query: {},
        headers: {},
        body: {},
      },
      res,
    )
    assert.equal(res.state.statusCode, 401)
    assert.equal(res.state.body?.error, "missing_token")
  })

  it("portfolio-sync trade-records mode still dispatches", async () => {
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
    assert.equal(res.state.statusCode, 401)
    assert.equal(res.state.body?.error, "missing_token")
  })

  it("api/me-membership.js entrypoint is removed", () => {
    let exists = true
    try {
      readFileSync(join(root, "api/me-membership.js"))
    } catch {
      exists = false
    }
    assert.equal(exists, false)
  })
})
