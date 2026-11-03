import { describe, expect, it } from "vitest"
import {
  isProUnlocked,
  MEMBERSHIP_STATUS,
  membershipPlanBadgeLabel,
  membershipStatusFromApiBody,
} from "./ydsMembership.js"

describe("ydsMembership", () => {
  it("unlocks PRO only for status pro", () => {
    expect(isProUnlocked(MEMBERSHIP_STATUS.PRO)).toBe(true)
    expect(isProUnlocked(MEMBERSHIP_STATUS.FREE)).toBe(false)
    expect(isProUnlocked(MEMBERSHIP_STATUS.LOADING)).toBe(false)
    expect(isProUnlocked(MEMBERSHIP_STATUS.ERROR)).toBe(false)
    expect(isProUnlocked(MEMBERSHIP_STATUS.LOGGED_OUT)).toBe(false)
    expect(isProUnlocked(null)).toBe(false)
  })

  it("maps API body without trusting missing/unknown plan as PRO", () => {
    expect(membershipStatusFromApiBody({ plan: "pro" })).toBe(MEMBERSHIP_STATUS.PRO)
    expect(membershipStatusFromApiBody({ plan: "free", reason: "missing_row" })).toBe(
      MEMBERSHIP_STATUS.FREE,
    )
    expect(membershipStatusFromApiBody({ plan: "PRO" })).toBe(MEMBERSHIP_STATUS.PRO)
    expect(membershipStatusFromApiBody({})).toBe(MEMBERSHIP_STATUS.FREE)
    expect(membershipStatusFromApiBody(null)).toBe(MEMBERSHIP_STATUS.FREE)
  })

  it("header badge shows PRO/FREE only after resolved membership", () => {
    expect(membershipPlanBadgeLabel(MEMBERSHIP_STATUS.PRO)).toBe("PRO")
    expect(membershipPlanBadgeLabel(MEMBERSHIP_STATUS.FREE)).toBe("FREE")
    expect(membershipPlanBadgeLabel(MEMBERSHIP_STATUS.LOADING)).toBe(null)
    expect(membershipPlanBadgeLabel(MEMBERSHIP_STATUS.LOGGED_OUT)).toBe(null)
    expect(membershipPlanBadgeLabel(MEMBERSHIP_STATUS.ERROR)).toBe(null)
    expect(membershipPlanBadgeLabel(null)).toBe(null)
  })
})
