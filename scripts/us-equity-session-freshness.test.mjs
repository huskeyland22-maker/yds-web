/**
 * US equity session + Panic core freshness (node:test).
 *   node --test scripts/us-equity-session-freshness.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { computePanicServeMeta } from "../api/_lib/panicServeMeta.js"
import {
  americaNyWallTimeToUtcMs,
  classifyPanicCoreFreshness,
  isUsEquityClosedDay,
  resolveUsEquitySession,
  rollBackToUsTradingDay,
} from "../api/_lib/usEquitySession.js"

function atNy(dateKey, hour, minute) {
  return new Date(americaNyWallTimeToUtcMs(dateKey, hour, minute, 0))
}

const fri = {
  date: "2026-11-20",
  vix: 35.89,
  fearGreed: 10,
  putCall: 11,
  updatedAt: "2026-11-20T21:05:00.000Z",
}

describe("us equity calendar", () => {
  it("marks weekends and listed holidays closed", () => {
    assert.equal(isUsEquityClosedDay("2026-11-21"), true)
    assert.equal(isUsEquityClosedDay("2026-11-22"), true)
    assert.equal(isUsEquityClosedDay("2026-11-26"), true)
    assert.equal(isUsEquityClosedDay("2026-11-20"), false)
    assert.equal(rollBackToUsTradingDay("2026-11-22"), "2026-11-20")
    assert.equal(rollBackToUsTradingDay("2026-11-26"), "2026-11-25")
  })
})

describe("panic core freshness scenarios", () => {
  it("Friday after close with Friday data → live", () => {
    const now = atNy("2026-11-20", 22, 30)
    const r = classifyPanicCoreFreshness({ asOfDate: "2026-11-20", coreComplete: true, now })
    assert.equal(r.status, "live")
    assert.equal(r.isStaleCompatible, false)
  })

  it("Saturday with Friday data → live", () => {
    const now = atNy("2026-11-21", 12, 0)
    const r = classifyPanicCoreFreshness({ asOfDate: "2026-11-20", coreComplete: true, now })
    assert.equal(r.session.phase, "calendar_closed")
    assert.equal(r.status, "live")
  })

  it("Sunday with Friday data → live", () => {
    const now = atNy("2026-11-22", 18, 0)
    const r = classifyPanicCoreFreshness({ asOfDate: "2026-11-20", coreComplete: true, now })
    assert.equal(r.status, "live")
  })

  it("Monday pre-open with Friday data → live", () => {
    const now = atNy("2026-11-23", 8, 0)
    const r = classifyPanicCoreFreshness({ asOfDate: "2026-11-20", coreComplete: true, now })
    assert.equal(r.session.phase, "pre_open")
    assert.equal(r.status, "live")
  })

  it("Monday during session with Friday data → waiting", () => {
    const now = atNy("2026-11-23", 11, 0)
    const r = classifyPanicCoreFreshness({ asOfDate: "2026-11-20", coreComplete: true, now })
    assert.equal(r.session.phase, "open")
    assert.equal(r.status, "waiting")
    assert.equal(r.isStaleCompatible, false)
  })

  it("Monday within post-close grace with Friday data → waiting", () => {
    const now = atNy("2026-11-23", 18, 0)
    const r = classifyPanicCoreFreshness({ asOfDate: "2026-11-20", coreComplete: true, now })
    assert.equal(r.session.phase, "grace")
    assert.equal(r.status, "waiting")
  })

  it("Monday after grace with Friday data → delayed", () => {
    const now = atNy("2026-11-23", 22, 30)
    const r = classifyPanicCoreFreshness({ asOfDate: "2026-11-20", coreComplete: true, now })
    assert.equal(r.session.phase, "after_grace")
    assert.equal(r.status, "delayed")
    assert.equal(r.isStaleCompatible, true)
  })

  it("Monday after grace with Monday data → live", () => {
    const now = atNy("2026-11-23", 22, 30)
    const r = classifyPanicCoreFreshness({ asOfDate: "2026-11-23", coreComplete: true, now })
    assert.equal(r.status, "live")
  })

  it("Thanksgiving closed day with prior trading day → live", () => {
    const now = atNy("2026-11-26", 15, 0)
    const r = classifyPanicCoreFreshness({ asOfDate: "2026-11-25", coreComplete: true, now })
    assert.equal(isUsEquityClosedDay("2026-11-26"), true)
    assert.equal(r.status, "live")
  })

  it("Tuesday after grace with only Friday data → delayed", () => {
    const now = atNy("2026-11-24", 22, 30)
    const r = classifyPanicCoreFreshness({ asOfDate: "2026-11-20", coreComplete: true, now })
    assert.equal(r.status, "delayed")
  })

  it("incomplete core → error / stale-compatible", () => {
    const now = atNy("2026-11-21", 12, 0)
    const r = classifyPanicCoreFreshness({ asOfDate: "2026-11-20", coreComplete: false, now })
    assert.equal(r.status, "error")
    assert.equal(r.isStaleCompatible, true)
  })

  it("DST spring-forward Monday session phases", () => {
    const pre = resolveUsEquitySession(atNy("2026-03-09", 8, 0))
    const open = resolveUsEquitySession(atNy("2026-03-09", 10, 0))
    assert.equal(pre.phase, "pre_open")
    assert.equal(open.phase, "open")
  })

  it("standard-time November Monday open window", () => {
    const open = resolveUsEquitySession(atNy("2026-11-23", 10, 0))
    assert.equal(open.nyDate, "2026-11-23")
    assert.equal(open.phase, "open")
  })
})

describe("API meta compat", () => {
  it("weekend Friday snapshot is not isStale", () => {
    const meta = computePanicServeMeta([], fri, { now: atNy("2026-11-22", 12, 0) })
    assert.equal(meta.isStale, false)
    assert.equal(meta.freshness.status, "live")
    assert.equal(meta.freshness.policy, "us_equity_session_manual_core")
  })

  it("Monday after grace with Friday snapshot is isStale", () => {
    const meta = computePanicServeMeta([], fri, { now: atNy("2026-11-23", 22, 30) })
    assert.equal(meta.isStale, true)
    assert.equal(meta.freshness.status, "delayed")
  })

  it("keeps ageMs and staleAfterMs fields", () => {
    const meta = computePanicServeMeta([], fri, { now: atNy("2026-11-21", 12, 0) })
    assert.ok("ageMs" in meta)
    assert.ok("staleAfterMs" in meta)
    assert.ok(meta.staleAfterMs >= 6 * 60 * 60 * 1000)
  })
})
