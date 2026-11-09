/**
 * Panic mode=backfill — cron auth + stored-V2 preservation (no live DB).
 * Usage: node --test scripts/panic-backfill-guard.test.mjs
 */
import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import { pathToFileURL } from "node:url"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

const { authorizePanicBackfillRequest } = await import(
  pathToFileURL(join(root, "api/_lib/panicBackfillAccess.js")).href,
)
const { verifyCronRequest } = await import(pathToFileURL(join(root, "api/_lib/cronAuth.js")).href)
const {
  selectBackfillCandidatesWithoutStoredV2,
  backfillPanicHistoryV2FromIndexHistory,
} = await import(pathToFileURL(join(root, "api/_lib/panicHistoryV2Db.js")).href)

const prevCron = process.env.CRON_SECRET
afterEach(() => {
  if (prevCron === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = prevCron
})

describe("panic backfill access (cron)", () => {
  it("rejects GET even with valid cron secret", () => {
    process.env.CRON_SECRET = "ops-secret-test"
    const gate = authorizePanicBackfillRequest({
      method: "GET",
      headers: { authorization: "Bearer ops-secret-test" },
    })
    assert.equal(gate.ok, false)
    assert.equal(gate.status, 405)
    assert.equal(gate.error, "method_not_allowed")
  })

  it("rejects POST without credentials", () => {
    process.env.CRON_SECRET = "ops-secret-test"
    const gate = authorizePanicBackfillRequest({ method: "POST", headers: {} })
    assert.equal(gate.ok, false)
    assert.equal(gate.status, 401)
    assert.equal(gate.error, "unauthorized")
  })

  it("rejects POST with wrong bearer", () => {
    process.env.CRON_SECRET = "ops-secret-test"
    const gate = authorizePanicBackfillRequest({
      method: "POST",
      headers: { authorization: "Bearer wrong" },
    })
    assert.equal(gate.ok, false)
    assert.equal(gate.status, 401)
  })

  it("allows POST with Authorization Bearer CRON_SECRET", () => {
    process.env.CRON_SECRET = "ops-secret-test"
    const gate = authorizePanicBackfillRequest({
      method: "POST",
      headers: { authorization: "Bearer ops-secret-test" },
    })
    assert.equal(gate.ok, true)
  })

  it("allows POST with x-cron-secret header", () => {
    process.env.CRON_SECRET = "ops-secret-test"
    const gate = authorizePanicBackfillRequest({
      method: "POST",
      headers: { "x-cron-secret": "ops-secret-test" },
    })
    assert.equal(gate.ok, true)
  })

  it("returns 503 when CRON_SECRET is unset", () => {
    delete process.env.CRON_SECRET
    const gate = authorizePanicBackfillRequest({
      method: "POST",
      headers: { authorization: "Bearer anything" },
    })
    assert.equal(gate.ok, false)
    assert.equal(gate.status, 503)
    assert.equal(gate.error, "cron_secret_not_configured")
  })

  it("membership-style bearer alone is not enough (wrong secret)", () => {
    process.env.CRON_SECRET = "ops-secret-test"
    const gate = authorizePanicBackfillRequest({
      method: "POST",
      headers: { authorization: "Bearer firebase-id-token-not-cron" },
    })
    assert.equal(gate.ok, false)
    assert.equal(verifyCronRequest({ headers: { authorization: "Bearer firebase-id-token-not-cron" } }).ok, false)
  })
})

describe("panic backfill stored V2 preservation", () => {
  it("skips dates that already have stored V2", () => {
    const { toFill, preserved } = selectBackfillCandidatesWithoutStoredV2(
      [
        { date: "2026-01-01", vix: 20 },
        { date: "2026-01-02", vix: 22 },
        { date: "2026-01-03", vix: 24 },
      ],
      new Set(["2026-01-02"]),
    )
    assert.equal(preserved, 1)
    assert.deepEqual(
      toFill.map((r) => r.date),
      ["2026-01-01", "2026-01-03"],
    )
  })

  it("does not upsert when all candidate dates already have stored V2", async () => {
    let upsertCalls = 0
    const result = await backfillPanicHistoryV2FromIndexHistory({
      days: 3,
      limit: 10,
      source: "unit_test",
      fetchIndexRows: async () => [
        {
          date: "2026-01-01",
          vix: 22,
          fear_greed: 30,
          put_call: 0.9,
          vvix: 90,
          vix_term: 1,
          ndx_distance: -2,
          soxx_distance: -2,
          dxy: 100,
          move: 80,
        },
        {
          date: "2026-01-02",
          vix: 24,
          fear_greed: 25,
          put_call: 1.0,
          vvix: 95,
          vix_term: 1,
          ndx_distance: -3,
          soxx_distance: -3,
          dxy: 101,
          move: 85,
        },
      ],
      fetchV2Rows: async () => [
        { date: "2026-01-01", panicV2: 42 },
        { date: "2026-01-02", panicV2: 55 },
      ],
      upsertRows: async () => {
        upsertCalls += 1
        return { ok: true, count: 1 }
      },
    })
    assert.equal(upsertCalls, 0)
    assert.equal(result.ok, true)
    assert.equal(result.skipped, true)
    assert.equal(result.reason, "all_dates_have_stored_v2")
    assert.equal(result.preserved, 2)
    assert.equal(result.inserted, 0)
  })

  it("upserts only missing dates and preserves stored ones", async () => {
    const upsertedDates = []
    const result = await backfillPanicHistoryV2FromIndexHistory({
      days: 5,
      limit: 10,
      source: "unit_test",
      fetchIndexRows: async () => [
        {
          date: "2026-01-01",
          vix: 22,
          fear_greed: 30,
          put_call: 0.9,
          vvix: 90,
          vix_term: 1.05,
          ndx_distance: -2,
          soxx_distance: -2,
          dxy: 100,
          move: 80,
        },
        {
          date: "2026-01-02",
          vix: 28,
          fear_greed: 18,
          put_call: 1.1,
          vvix: 110,
          vix_term: 0.95,
          ndx_distance: -5,
          soxx_distance: -6,
          dxy: 103,
          move: 100,
        },
      ],
      fetchV2Rows: async () => [{ date: "2026-01-01", panicV2: 42 }],
      upsertRows: async (rows) => {
        for (const r of rows) upsertedDates.push(String(r.date).slice(0, 10))
        return { ok: true, count: rows.length, dates: upsertedDates.slice() }
      },
    })
    assert.equal(result.ok, true)
    assert.equal(result.preserved, 1)
    assert.ok(result.inserted >= 1)
    assert.ok(upsertedDates.includes("2026-01-02"))
    assert.equal(upsertedDates.includes("2026-01-01"), false)
  })

  it("refuses upsert when existing V2 lookup fails (no blind overwrite)", async () => {
    let upsertCalls = 0
    const result = await backfillPanicHistoryV2FromIndexHistory({
      days: 2,
      limit: 5,
      fetchIndexRows: async () => [
        {
          date: "2026-01-01",
          vix: 22,
          fear_greed: 30,
          put_call: 0.9,
          vvix: 90,
          move: 80,
        },
      ],
      fetchV2Rows: async () => {
        throw new Error("lookup_down")
      },
      upsertRows: async () => {
        upsertCalls += 1
        return { ok: true, count: 1 }
      },
    })
    assert.equal(upsertCalls, 0)
    assert.equal(result.ok, false)
    assert.equal(result.skipped, true)
    assert.equal(result.reason, "existing_v2_lookup_failed")
  })
})

describe("panic.js backfill wiring (source)", () => {
  it("wires authorizePanicBackfillRequest and POST-only backfill", async () => {
    const { readFileSync } = await import("node:fs")
    const src = readFileSync(join(root, "api/panic.js"), "utf8")
    assert.match(src, /authorizePanicBackfillRequest/)
    assert.match(src, /case "backfill"/)
    assert.doesNotMatch(
      src,
      /case "backfill":[\s\S]*req\.method !== "GET" && req\.method !== "POST"/,
    )
  })
})

console.log("panic-backfill-guard.test.mjs OK")
