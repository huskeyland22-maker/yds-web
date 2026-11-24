import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  classifyCreditCycleSupabaseUrl,
  classifyCreditCycleSupabaseKey,
  buildCreditCycleRestAuthHeaders,
  resolveCreditCycleRestKey,
  resolveCreditCycleServerConfig,
  redactLicenseRestrictedIndicator,
  CREDIT_CYCLE_STAGING_REF,
  CREDIT_CYCLE_PRODUCTION_REF,
} from "./creditCycleEnv.js"
import {
  buildCreditCycleDisabledPayload,
  handleCreditCycleLatest,
  mapSnapshotRow,
  CREDIT_CYCLE_SNAPSHOT_SELECT,
  CREDIT_CYCLE_SCORE_SELECT,
} from "./creditCycleApiHandlers.js"

describe("creditCycleEnv gates", () => {
  it("classifies staging vs production refs", () => {
    assert.equal(
      classifyCreditCycleSupabaseUrl(`https://${CREDIT_CYCLE_STAGING_REF}.supabase.co`),
      "staging",
    )
    assert.equal(
      classifyCreditCycleSupabaseUrl(`https://${CREDIT_CYCLE_PRODUCTION_REF}.supabase.co`),
      "production",
    )
    assert.equal(classifyCreditCycleSupabaseUrl(""), "missing")
  })

  it("refuses production URL even if API enabled", () => {
    const cfg = resolveCreditCycleServerConfig({
      CREDIT_CYCLE_API_ENABLED: "1",
      CREDIT_CYCLE_DATA_MODE: "staging",
      CREDIT_CYCLE_SUPABASE_URL: `https://${CREDIT_CYCLE_PRODUCTION_REF}.supabase.co`,
      CREDIT_CYCLE_SUPABASE_SERVICE_ROLE_KEY: "secret",
    })
    assert.equal(cfg.ok, false)
    assert.equal(cfg.reason, "production_url_refused")
    assert.ok(cfg.blockers.includes("production_url_refused"))
  })

  it("does not use VITE_SUPABASE_URL as fallback", () => {
    const cfg = resolveCreditCycleServerConfig({
      CREDIT_CYCLE_API_ENABLED: "1",
      CREDIT_CYCLE_DATA_MODE: "staging",
      VITE_SUPABASE_URL: `https://${CREDIT_CYCLE_STAGING_REF}.supabase.co`,
      SUPABASE_URL: `https://${CREDIT_CYCLE_STAGING_REF}.supabase.co`,
      SUPABASE_SERVICE_ROLE_KEY: "generic-secret",
      // CREDIT_CYCLE_SUPABASE_URL intentionally omitted
    })
    assert.equal(cfg.ok, false)
    assert.ok(cfg.blockers.includes("missing_credit_cycle_supabase_url"))
  })

  it("requires explicit enable + staging mode + staging url + key", () => {
    const cfg = resolveCreditCycleServerConfig({
      CREDIT_CYCLE_API_ENABLED: "1",
      CREDIT_CYCLE_DATA_MODE: "staging",
      CREDIT_CYCLE_SUPABASE_URL: `https://${CREDIT_CYCLE_STAGING_REF}.supabase.co`,
      CREDIT_CYCLE_SUPABASE_SERVICE_ROLE_KEY: "secret",
    })
    assert.equal(cfg.ok, true)
    assert.equal(cfg.projectKind, "staging")
  })

  it("default empty env → disabled", () => {
    const cfg = resolveCreditCycleServerConfig({})
    assert.equal(cfg.ok, false)
    assert.ok(cfg.blockers.includes("api_disabled"))
  })

  it("redacts HY/BBB numerics", () => {
    const row = redactLicenseRestrictedIndicator({
      indicator_code: "hy",
      value: 5.5,
      riskScore: 80,
      change: 1.2,
    })
    assert.equal(row.value, null)
    assert.equal(row.riskScore, null)
    assert.equal(row.change, null)
    assert.equal(row.license_restricted, true)
  })

  it("classifies sb_secret vs jwt keys", () => {
    assert.equal(classifyCreditCycleSupabaseKey("sb_secret_test_value"), "sb_secret")
    assert.equal(classifyCreditCycleSupabaseKey("sb_publishable_test_value"), "sb_publishable")
    assert.equal(classifyCreditCycleSupabaseKey("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.a.b"), "jwt")
    assert.equal(classifyCreditCycleSupabaseKey(""), "missing")
  })

  it("sb_secret headers use apikey only (no Bearer)", () => {
    const h = buildCreditCycleRestAuthHeaders("sb_secret_test_value")
    assert.equal(h.apikey, "sb_secret_test_value")
    assert.equal(h.Authorization, undefined)
    assert.equal(h.Accept, "application/json")
  })

  it("jwt service_role headers keep Bearer", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.a.b"
    const h = buildCreditCycleRestAuthHeaders(jwt)
    assert.equal(h.apikey, jwt)
    assert.equal(h.Authorization, `Bearer ${jwt}`)
  })

  it("prefers CREDIT_CYCLE_SUPABASE_SECRET_KEY alias", () => {
    const resolved = resolveCreditCycleRestKey({
      CREDIT_CYCLE_SUPABASE_SECRET_KEY: "sb_secret_preferred",
      CREDIT_CYCLE_SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.a.b",
      CREDIT_CYCLE_SUPABASE_ANON_KEY: "sb_publishable_anon",
    })
    assert.equal(resolved.keyKind, "sb_secret")
    assert.equal(resolved.privileged, true)
    assert.equal(resolved.key.startsWith("sb_secret_"), true)
  })
})

describe("creditCycleApiHandlers disabled", () => {
  it("latest returns 503 when disabled without inventing CCI", async () => {
    /** @type {any} */
    let status = 0
    /** @type {any} */
    let body = null
    const res = {
      setHeader() {},
      end(s) {
        body = JSON.parse(s)
      },
      set statusCode(v) {
        status = v
      },
      get statusCode() {
        return status
      },
    }
    await handleCreditCycleLatest({ url: "/api/credit-cycle?mode=latest", method: "GET" }, res, {
      env: {},
    })
    assert.equal(status, 503)
    assert.equal(body.ok, false)
    assert.equal(body.enabled, false)
    assert.equal(body.cci, undefined)
    assert.ok(body.reason)
  })

  it("buildCreditCycleDisabledPayload is stable", () => {
    const p = buildCreditCycleDisabledPayload({})
    assert.equal(p.ok, false)
    assert.equal(p.feedStatus, "API_DISABLED")
    assert.equal(p.warningEvidence, "INSUFFICIENT_EVIDENCE")
  })

  it("snapshot select list and mapper never expose payload", () => {
    assert.equal(CREDIT_CYCLE_SNAPSHOT_SELECT.includes("payload"), false)
    assert.ok(CREDIT_CYCLE_SNAPSHOT_SELECT.includes("as_of_date"))
    assert.ok(CREDIT_CYCLE_SNAPSHOT_SELECT.includes("id"))
    assert.equal(CREDIT_CYCLE_SCORE_SELECT.includes("payload"), false)
    const mapped = mapSnapshotRow({
      as_of_date: "2026-01-01",
      cci_score: 40,
      coverage: 1,
      confidence_status: "OK",
      regime: null,
      data_mode: "license_safe",
      pit_status: "NON_PIT",
      hold_reason: null,
      calculation_version: "t",
      created_at: "2026-01-01T00:00:00Z",
      payload: { hy: 5.5, bbb: 1.2 },
    })
    assert.equal(mapped.payload, undefined)
    assert.equal(JSON.stringify(mapped).includes("hy"), false)
    assert.equal(mapped.cci, 40)
  })

  it("staging config without ALLOW_REMOTE still 503 (no remote connect)", async () => {
    /** @type {any} */
    let status = 0
    /** @type {any} */
    let body = null
    const res = {
      setHeader() {},
      end(s) {
        body = JSON.parse(s)
      },
      set statusCode(v) {
        status = v
      },
      get statusCode() {
        return status
      },
    }
    await handleCreditCycleLatest({ url: "/api/credit-cycle?mode=latest", method: "GET" }, res, {
      env: {
        CREDIT_CYCLE_API_ENABLED: "1",
        CREDIT_CYCLE_DATA_MODE: "staging",
        CREDIT_CYCLE_SUPABASE_URL: `https://${CREDIT_CYCLE_STAGING_REF}.supabase.co`,
        CREDIT_CYCLE_SUPABASE_SERVICE_ROLE_KEY: "secret",
        // CREDIT_CYCLE_ALLOW_REMOTE omitted on purpose
      },
    })
    assert.equal(status, 503)
    assert.equal(body.ok, false)
    assert.equal(body.remoteArmed, false)
  })
})
