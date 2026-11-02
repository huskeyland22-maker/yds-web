import { describe, expect, it } from "vitest"
import {
  isProUnlocked,
  MEMBERSHIP_STATUS,
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
})
