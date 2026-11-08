import { describe, expect, it } from "vitest"
import {
  isMembershipVerifyUiEnabled,
  isProUnlocked,
  MEMBERSHIP_STATUS,
  membershipHeaderBadgeState,
  membershipPlanBadgeLabel,
  membershipStatusFromApiBody,
  membershipVerifyDisplayModel,
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

  it("header presentation keeps layout during loading and fail-closed FREE on error", () => {
    expect(membershipHeaderBadgeState(MEMBERSHIP_STATUS.PRO)).toEqual({ kind: "pro", label: "PRO" })
    expect(membershipHeaderBadgeState(MEMBERSHIP_STATUS.FREE)).toEqual({ kind: "free", label: "FREE" })
    expect(membershipHeaderBadgeState(MEMBERSHIP_STATUS.LOADING)).toEqual({
      kind: "pending",
      label: "···",
    })
    expect(membershipHeaderBadgeState(MEMBERSHIP_STATUS.ERROR)).toEqual({
      kind: "free",
      label: "FREE",
    })
    expect(membershipHeaderBadgeState(MEMBERSHIP_STATUS.LOGGED_OUT)).toEqual({
      kind: "hidden",
      label: null,
    })
  })

  it("enables membership verify UI on Preview/local hosts only", () => {
    expect(isMembershipVerifyUiEnabled("yds-web-kappa.vercel.app", { dev: false })).toBe(false)
    expect(
      isMembershipVerifyUiEnabled("yds-d7k3q1jzy-so-sung-yangs-projects.vercel.app", {
        dev: false,
      }),
    ).toBe(true)
    expect(
      isMembershipVerifyUiEnabled(
        "yds-web-git-rc1-membership-infra-so-sung-yangs-projects.vercel.app",
        { dev: false },
      ),
    ).toBe(true)
    expect(isMembershipVerifyUiEnabled("localhost", { dev: false })).toBe(true)
    expect(isMembershipVerifyUiEnabled("yds-web-kappa.vercel.app", { dev: true })).toBe(true)
  })

  it("builds a safe membership verify display model", () => {
    expect(
      membershipVerifyDisplayModel({
        isLoading: false,
        isError: false,
        isLoggedOut: false,
        plan: "free",
        ledgerStatus: "none",
        source: null,
        reason: "missing_row",
      }),
    ).toEqual({
      phase: "ready",
      planLabel: "FREE",
      statusLabel: "none",
      sourceLabel: "—",
      reasonLabel: "missing_row",
      showRefresh: true,
    })
    expect(membershipVerifyDisplayModel({ isLoading: true }).phase).toBe("loading")
    expect(membershipVerifyDisplayModel({ isError: true, reason: "http_500" })).toMatchObject({
      phase: "error",
      reasonLabel: "http_500",
      showRefresh: true,
    })
    expect(membershipVerifyDisplayModel({ isLoggedOut: true }).showRefresh).toBe(false)
  })
})
