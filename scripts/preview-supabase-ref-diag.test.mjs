/**
 * Preview-only Supabase project-ref diagnostic (TEMP).
 * Remove with: api/_lib/previewSupabaseRefDiag.js, portfolio-sync branch,
 * vercel.json rewrite, verify-api-modules entry, and this test file.
 *
 * node --test scripts/preview-supabase-ref-diag.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  STAGING_SUPABASE_PROJECT_REF,
  buildPreviewSupabaseRefDiagPayload,
  extractSupabaseProjectRef,
  handlePreviewSupabaseRefDiag,
} from "../api/_lib/previewSupabaseRefDiag.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

const FORBIDDEN_BODY_KEYS = [
  "url",
  "key",
  "supabaseUrl",
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "serviceRole",
  "service_role",
  "SUPABASE_SERVICE_ROLE_KEY",
  "records",
  "token",
]

function mockRes() {
  const state = { statusCode: 200, body: null, headers: {} }
  return {
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
}

function assertNoSecrets(body) {
  assert.ok(body && typeof body === "object")
  for (const k of FORBIDDEN_BODY_KEYS) {
    assert.equal(Object.hasOwn(body, k), false, `must not expose key: ${k}`)
  }
  const dumped = JSON.stringify(body)
  assert.equal(dumped.includes("supabase.co"), false, "must not embed supabase host URL")
  assert.equal(dumped.includes("eyJ"), false, "must not embed JWT-like secrets")
  assert.equal(dumped.includes("service_role"), false)
}

describe("extractSupabaseProjectRef", () => {
  it("parses staging hostname to ref only", () => {
    assert.equal(
      extractSupabaseProjectRef(`https://${STAGING_SUPABASE_PROJECT_REF}.supabase.co`),
      STAGING_SUPABASE_PROJECT_REF,
    )
  })

  it("returns null for empty or invalid", () => {
    assert.equal(extractSupabaseProjectRef(""), null)
    assert.equal(extractSupabaseProjectRef("not-a-url"), null)
  })
})

describe("buildPreviewSupabaseRefDiagPayload", () => {
  it("allows Preview and reports matchesStaging", () => {
    const built = buildPreviewSupabaseRefDiagPayload({
      vercelEnv: "preview",
      url: `https://${STAGING_SUPABASE_PROJECT_REF}.supabase.co`,
      key: "test-key-not-real",
    })
    assert.equal(built.allowed, true)
    assert.deepEqual(built.body, {
      environment: "preview",
      configured: true,
      supabaseProjectRef: STAGING_SUPABASE_PROJECT_REF,
      matchesStaging: true,
    })
    assertNoSecrets(built.body)
  })

  it("marks non-staging ref as matchesStaging false", () => {
    const built = buildPreviewSupabaseRefDiagPayload({
      vercelEnv: "preview",
      url: "https://oausvweyocgynjpeguka.supabase.co",
      key: "x",
    })
    assert.equal(built.body.matchesStaging, false)
    assert.equal(built.body.supabaseProjectRef, "oausvweyocgynjpeguka")
    assertNoSecrets(built.body)
  })

  it("blocks non-preview environments (no diagnostic body)", () => {
    for (const vercelEnv of ["production", "development", "", undefined]) {
      const built = buildPreviewSupabaseRefDiagPayload({
        vercelEnv,
        url: `https://${STAGING_SUPABASE_PROJECT_REF}.supabase.co`,
        key: "x",
      })
      assert.equal(built.allowed, false)
      assert.equal(built.body, undefined)
    }
  })
})

describe("handlePreviewSupabaseRefDiag", () => {
  it("Preview GET returns only allowed fields", async () => {
    const res = mockRes()
    await handlePreviewSupabaseRefDiag({ method: "GET" }, res, {
      vercelEnv: "preview",
      getSupabaseConfig: () => ({
        url: `https://${STAGING_SUPABASE_PROJECT_REF}.supabase.co`,
        key: "role-key-placeholder",
      }),
    })
    assert.equal(res.state.statusCode, 200)
    assert.deepEqual(Object.keys(res.state.body).sort(), [
      "configured",
      "environment",
      "matchesStaging",
      "supabaseProjectRef",
    ])
    assert.equal(res.state.body.environment, "preview")
    assert.equal(res.state.body.configured, true)
    assert.equal(res.state.body.supabaseProjectRef, STAGING_SUPABASE_PROJECT_REF)
    assert.equal(res.state.body.matchesStaging, true)
    assertNoSecrets(res.state.body)
  })

  it("Production returns 403 without diagnostic fields", async () => {
    const res = mockRes()
    await handlePreviewSupabaseRefDiag({ method: "GET" }, res, {
      vercelEnv: "production",
      getSupabaseConfig: () => ({
        url: `https://${STAGING_SUPABASE_PROJECT_REF}.supabase.co`,
        key: "x",
      }),
    })
    assert.equal(res.state.statusCode, 403)
    assert.deepEqual(res.state.body, { error: "forbidden" })
    assert.equal(res.state.body.supabaseProjectRef, undefined)
    assert.equal(res.state.body.matchesStaging, undefined)
  })

  it("local/development returns 403", async () => {
    for (const vercelEnv of ["development", ""]) {
      const res = mockRes()
      await handlePreviewSupabaseRefDiag({ method: "GET" }, res, {
        vercelEnv,
        getSupabaseConfig: () => ({
          url: `https://${STAGING_SUPABASE_PROJECT_REF}.supabase.co`,
          key: "x",
        }),
      })
      assert.equal(res.state.statusCode, 403)
      assert.deepEqual(res.state.body, { error: "forbidden" })
    }
  })

  it("non-GET → 405", async () => {
    const res = mockRes()
    await handlePreviewSupabaseRefDiag({ method: "POST" }, res, {
      vercelEnv: "preview",
      getSupabaseConfig: () => ({ url: "https://x.supabase.co", key: "x" }),
    })
    assert.equal(res.state.statusCode, 405)
    assert.equal(res.state.body?.error, "method_not_allowed")
  })
})

describe("preview-supabase-ref wiring", () => {
  it("vercel rewrite maps /api/preview-supabase-ref → portfolio-sync mode", () => {
    const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"))
    const hit = vercel.rewrites?.find((r) => r.source === "/api/preview-supabase-ref")
    assert.ok(hit, "missing preview-supabase-ref rewrite")
    assert.equal(hit.destination, "/api/portfolio-sync?ydsMode=preview-supabase-ref")
  })

  it("portfolio-sync dispatches preview-supabase-ref mode", () => {
    const src = readFileSync(join(root, "api/portfolio-sync.js"), "utf8")
    assert.match(src, /preview-supabase-ref/)
    assert.match(src, /handlePreviewSupabaseRefDiag/)
  })
})
