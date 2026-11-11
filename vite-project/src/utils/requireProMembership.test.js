import { describe, expect, it, vi } from "vitest"
import {
  MembershipLookupError,
  resolveMembershipFromRow,
} from "../../../api/_lib/userMembership.js"
import { requireProMembership } from "../../../api/_lib/requireProMembership.js"

function reqWithAuth(token) {
  return {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  }
}

describe("requireProMembership", () => {
  it("returns 401 when token is missing", async () => {
    const result = await requireProMembership(reqWithAuth(null), {
      verifyFirebaseIdToken: vi.fn(),
      resolveUserMembership: vi.fn(),
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
      expect(result.body.error).toBe("missing_token")
    }
  })

  it("returns 401 when Firebase token is invalid", async () => {
    const result = await requireProMembership(reqWithAuth("bad"), {
      verifyFirebaseIdToken: vi.fn(async () => {
        throw new Error("INVALID_ID_TOKEN")
      }),
      resolveUserMembership: vi.fn(),
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
      expect(result.body.error).toBe("invalid_token")
    }
  })

  it("returns 403 pro_required for FREE (missing row)", async () => {
    const result = await requireProMembership(reqWithAuth("tok"), {
      verifyFirebaseIdToken: vi.fn(async () => "uid-free"),
      resolveUserMembership: vi.fn(async () => resolveMembershipFromRow(null)),
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(403)
      expect(result.body.error).toBe("pro_required")
      expect(result.body.plan).toBe("free")
      expect(result.body.reason).toBe("missing_row")
    }
  })

  it("returns 403 for revoked membership", async () => {
    const result = await requireProMembership(reqWithAuth("tok"), {
      verifyFirebaseIdToken: vi.fn(async () => "uid-revoked"),
      resolveUserMembership: vi.fn(async () =>
        resolveMembershipFromRow({
          firebase_uid: "uid-revoked",
          plan: "pro",
          status: "revoked",
          source: "manual",
          updated_at: null,
        }),
      ),
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(403)
      expect(result.body.error).toBe("pro_required")
      expect(result.body.reason).toBe("inactive")
    }
  })

  it("fail-closes when membership lookup fails", async () => {
    const result = await requireProMembership(reqWithAuth("tok"), {
      verifyFirebaseIdToken: vi.fn(async () => "uid-x"),
      resolveUserMembership: vi.fn(async () => {
        throw new MembershipLookupError("membership_lookup_failed", "db")
      }),
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(500)
      expect(result.body.error).toBe("membership_lookup_failed")
    }
  })

  it("allows an operator claim without changing the free ledger plan", async () => {
    const result = await requireProMembership(reqWithAuth("tok"), {
      verifyFirebaseAuthUser: vi.fn(async () => ({
        uid: "uid-operator",
        claims: { role: "operator" },
      })),
      resolveUserMembership: vi.fn(async () => resolveMembershipFromRow(null)),
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.audience).toBe("operator")
      expect(result.membership.plan).toBe("free")
    }
  })

  it("allows active PRO membership", async () => {
    const membership = resolveMembershipFromRow({
      firebase_uid: "uid-pro",
      plan: "pro",
      status: "active",
      source: "staging_test",
      updated_at: "2026-11-02T00:00:00.000Z",
    })
    const result = await requireProMembership(reqWithAuth("tok"), {
      verifyFirebaseIdToken: vi.fn(async () => "uid-pro"),
      resolveUserMembership: vi.fn(async () => membership),
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.uid).toBe("uid-pro")
      expect(result.membership.plan).toBe("pro")
      expect(result.membership.reason).toBe("plan_pro")
    }
  })
})
