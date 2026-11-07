/**
 * Pure FREE/PRO resolution from user_membership rows (no network).
 * node --test scripts/user-membership-resolve.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isProMembership,
  resolveMembershipFromRow,
} from "../api/_lib/userMembership.js"

describe("resolveMembershipFromRow", () => {
  it("missing row → FREE missing_row", () => {
    const r = resolveMembershipFromRow(null)
    assert.equal(r.plan, "free")
    assert.equal(r.reason, "missing_row")
    assert.equal(isProMembership(r), false)
  })

  it("active pro → PRO", () => {
    const r = resolveMembershipFromRow({
      firebase_uid: "u1",
      plan: "pro",
      status: "active",
      source: "manual",
      updated_at: "2026-11-01T00:00:00.000Z",
    })
    assert.equal(r.plan, "pro")
    assert.equal(r.reason, "plan_pro")
    assert.equal(isProMembership(r), true)
  })

  it("active free → FREE", () => {
    const r = resolveMembershipFromRow({
      firebase_uid: "u2",
      plan: "free",
      status: "active",
      source: null,
      updated_at: null,
    })
    assert.equal(r.plan, "free")
    assert.equal(r.reason, "plan_free")
    assert.equal(isProMembership(r), false)
  })

  it("pro but revoked → FREE inactive", () => {
    const r = resolveMembershipFromRow({
      firebase_uid: "u3",
      plan: "pro",
      status: "revoked",
      source: "manual",
      updated_at: null,
    })
    assert.equal(r.plan, "free")
    assert.equal(r.reason, "inactive")
    assert.equal(isProMembership(r), false)
  })

  it("does not trust client-looking unknown plan strings as PRO", () => {
    const r = resolveMembershipFromRow({
      firebase_uid: "u4",
      plan: "PRO_PLUS",
      status: "active",
      source: "x",
      updated_at: null,
    })
    assert.equal(r.plan, "free")
    assert.equal(r.reason, "plan_free")
  })
})
