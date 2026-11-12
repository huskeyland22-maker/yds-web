/**
 * Operator detail access is separate from a PRO subscription.
 * No network, no membership writes.
 * node --test scripts/operator-detail-access.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { claimsFromLookupUser } from "../api/_lib/firebaseIdToken.js"
import { requireProMembership } from "../api/_lib/requireProMembership.js"
import {
  isOperatorClaim,
  isProMembership,
  resolveDetailAccess,
  resolveMembershipFromRow,
} from "../api/_lib/userMembership.js"
import { equityViewProgressEntry } from "../vite-project/src/content/ydsDbbBuyProgress.js"
import { buildDbbTradeStatusView, tradeQuoteStateLabel } from "../vite-project/src/content/ydsTradeRecordsStatus.js"
import { averageTradeBuyPrice, tradeReturnPct } from "../vite-project/src/content/ydsTradeRecords.js"
import { detailAccessFromApiBody } from "../vite-project/src/content/ydsMembership.js"
const freeRow = resolveMembershipFromRow(null)
const proRow = resolveMembershipFromRow({
  firebase_uid: "pro-user",
  plan: "pro",
  status: "active",
  source: "manual",
  updated_at: null,
})

function req(token) {
  return { headers: token ? { authorization: `Bearer ${token}` } : {} }
}

describe("operator claim", () => {
  it("reads only the operator role from verified custom claims", () => {
    assert.equal(isOperatorClaim({ role: "operator" }), true)
    assert.equal(isOperatorClaim({ role: " Operator " }), true)
    assert.equal(isOperatorClaim({ role: "pro" }), false)
    assert.equal(isOperatorClaim({ role: "admin" }), false)
    assert.equal(isOperatorClaim({ operator: true }), false)
    assert.equal(isOperatorClaim(null), false)
    const claims = claimsFromLookupUser({
      customAttributes: JSON.stringify({ role: "operator" }),
    })
    assert.equal(isOperatorClaim(claims), true)
    assert.deepEqual(claimsFromLookupUser({ customAttributes: "not-json" }), {})
  })

  it("keeps operator off the PRO plan", () => {
    const access = resolveDetailAccess(freeRow, { role: "operator" })
    assert.equal(access.detailAccess, true)
    assert.equal(access.audience, "operator")
    assert.equal(freeRow.plan, "free")
    assert.equal(isProMembership(freeRow), false)
    const subscription = resolveDetailAccess(proRow, {})
    assert.equal(subscription.audience, "pro")
    assert.equal(resolveDetailAccess(freeRow, { role: "pro" }).detailAccess, false)
  })
})

describe("requireProMembership audiences", () => {
  it("allows an operator without turning the ledger plan into pro", async () => {
    const result = await requireProMembership(req("tok"), {
      verifyFirebaseAuthUser: async () => ({ uid: "op-1", claims: { role: "operator" } }),
      resolveUserMembership: async () => freeRow,
    })
    assert.equal(result.ok, true)
    assert.equal(result.audience, "operator")
    assert.equal(result.membership.plan, "free")
    assert.equal(result.membership.reason, "missing_row")
  })

  it("blocks FREE without the operator claim", async () => {
    const result = await requireProMembership(req("tok"), {
      verifyFirebaseAuthUser: async () => ({ uid: "free-1", claims: {} }),
      resolveUserMembership: async () => freeRow,
    })
    assert.equal(result.ok, false)
    assert.equal(result.status, 403)
    assert.equal(result.body.audience, "free")
  })

  it("allows an active PRO subscription", async () => {
    const result = await requireProMembership(req("tok"), {
      verifyFirebaseIdToken: async () => "pro-user",
      resolveUserMembership: async () => proRow,
    })
    assert.equal(result.ok, true)
    assert.equal(result.audience, "pro")
    assert.equal(result.membership.plan, "pro")
  })

  it("blocks a missing token", async () => {
    const result = await requireProMembership(req(null), {
      verifyFirebaseAuthUser: async () => {
        throw new Error("should_not_run")
      },
    })
    assert.equal(result.ok, false)
    assert.equal(result.status, 401)
  })

  it("blocks when membership lookup fails, even if a claim is present", async () => {
    const result = await requireProMembership(req("tok"), {
      verifyFirebaseAuthUser: async () => ({ uid: "op-1", claims: { role: "operator" } }),
      resolveUserMembership: async () => {
        throw new Error("lookup_down")
      },
    })
    assert.equal(result.ok, false)
    assert.equal(result.status, 500)
    assert.equal(result.body.error, "membership_lookup_failed")
  })
})

describe("quote display", () => {
  const records = [
    {
      id: "r1",
      system: "dbb",
      symbol: "AAPL",
      buyDate: "2026-08-27",
      buyPrice: 300,
      buyAmountUsd: 300,
      shares: 1,
      weightPct: 50,
      memo: "",
      createdAt: "2026-08-27T00:00:00.000Z",
      updatedAt: "2026-08-27T00:00:00.000Z",
    },
    {
      id: "r2",
      system: "dbb",
      symbol: "AAPL",
      buyDate: "2026-10-05",
      buyPrice: 329.28,
      buyAmountUsd: 329.28,
      shares: 1,
      weightPct: 50,
      memo: "",
      createdAt: "2026-10-05T00:00:00.000Z",
      updatedAt: "2026-10-05T00:00:00.000Z",
    },
  ]

  it("calculates return from a real operator price and leaves the average unchanged", () => {
    const entry = equityViewProgressEntry(
      { symbol: "AAPL", name: "Apple" },
      { ok: true, symbol: "AAPL", access: "full", audience: "operator", score: 3, price: 330, asOf: "2026-11-10", state: { label: "1차 매수" } },
    )
    const before = averageTradeBuyPrice(records)
    const view = buildDbbTradeStatusView(entry.card, records, "2026-11-10")
    assert.equal(view.priceState, "ready")
    assert.equal(view.currentPrice, 330)
    assert.equal(view.avgBuyPrice, before)
    assert.equal(view.returnPct, tradeReturnPct(before, 330))
    assert.equal(tradeQuoteStateLabel(view.priceState), null)
  })

  it("does not calculate a return when the price is missing", () => {
    const entry = equityViewProgressEntry(
      { symbol: "AAPL", name: "Apple" },
      { ok: true, symbol: "AAPL", access: "full", score: 3, price: null, asOf: "2026-11-10", state: { label: "1차 매수" } },
    )
    const view = buildDbbTradeStatusView(entry.card, records, "2026-11-10")
    assert.equal(view.priceState, "missing")
    assert.equal(view.currentPrice, null)
    assert.equal(view.returnPct, null)
    assert.equal(tradeReturnPct(view.avgBuyPrice, null), null)
    assert.equal(tradeQuoteStateLabel("missing"), "시세 없음")
  })

  it("hides a leaked price from a summary payload", () => {
    const entry = equityViewProgressEntry(
      { symbol: "AAPL", name: "Apple" },
      { ok: true, symbol: "AAPL", access: "summary", score: 3, price: 330, state: { label: "1차 매수" } },
    )
    const view = buildDbbTradeStatusView(entry.card, records, null)
    assert.equal(view.priceState, "forbidden")
    assert.equal(view.currentPrice, null)
    assert.equal(view.returnPct, null)
    assert.ok(view.avgBuyPrice > 0)
    assert.equal(tradeQuoteStateLabel("forbidden"), "권한 없음")
    assert.equal(tradeQuoteStateLabel("loading"), "확인 중")
    assert.equal(tradeQuoteStateLabel("error"), "데이터 오류")
    assert.equal(detailAccessFromApiBody({ plan: "free", detailAccess: true }), true)
    assert.equal(detailAccessFromApiBody({ plan: "pro" }), false)
    assert.equal(detailAccessFromApiBody({ plan: "free", detailAccess: "true" }), false)
  })
})

describe("temporary owner pro", () => {
  it("opens Pro for the owner UID only and does not mutate the ledger row", async () => {
    const { applyTemporaryOwnerPro, isTemporaryOwnerProUid } = await import("../api/_lib/temporaryOwnerPro.js")
    const ownerUid = "9mm60sKonGc3NoSC71lQG2Vp2jG2"
    assert.equal(isTemporaryOwnerProUid(ownerUid), true)
    assert.equal(isTemporaryOwnerProUid("someone-else"), false)
    const upgraded = applyTemporaryOwnerPro(ownerUid, freeRow)
    assert.equal(upgraded.plan, "pro")
    assert.equal(upgraded.reason, "temporary_owner_pro")
    assert.equal(freeRow.plan, "free")
    assert.equal(resolveDetailAccess(upgraded, {}).audience, "pro")
    assert.equal(applyTemporaryOwnerPro("someone-else", freeRow).plan, "free")
    assert.equal(applyTemporaryOwnerPro(ownerUid, proRow).reason, "plan_pro")
  })
})
