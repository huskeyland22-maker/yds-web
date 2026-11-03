/**
 * Membership UI status derived from GET /api/me-membership.
 * Server ledger is the source of truth — clients never invent plan/uid.
 */

/** @typedef {"logged_out" | "loading" | "free" | "pro" | "error"} MembershipStatus */

export const MEMBERSHIP_STATUS = Object.freeze({
  LOGGED_OUT: "logged_out",
  LOADING: "loading",
  FREE: "free",
  PRO: "pro",
  ERROR: "error",
})

/**
 * PRO UI/features unlock only when the server returned plan === "pro".
 * loading / free / error / logged_out stay locked (fail closed).
 * @param {MembershipStatus | string | null | undefined} status
 * @returns {boolean}
 */
export function isProUnlocked(status) {
  return status === MEMBERSHIP_STATUS.PRO
}

/**
 * Header plan badge label from server membership status.
 * Strict resolved plans only (no loading / logged out / error).
 * @param {MembershipStatus | string | null | undefined} status
 * @returns {"PRO" | "FREE" | null}
 */
export function membershipPlanBadgeLabel(status) {
  if (status === MEMBERSHIP_STATUS.PRO) return "PRO"
  if (status === MEMBERSHIP_STATUS.FREE) return "FREE"
  return null
}

/**
 * Mobile/desktop header badge presentation.
 * - logged out → hidden
 * - loading → pending placeholder (keeps layout stable)
 * - error while signed-in → FREE chip (fail-closed display only; does not unlock PRO APIs)
 * - free / pro → matching chip
 * @param {MembershipStatus | string | null | undefined} status
 * @returns {{ kind: "hidden" | "pending" | "pro" | "free", label: string | null }}
 */
export function membershipHeaderBadgeState(status) {
  if (status == null || status === MEMBERSHIP_STATUS.LOGGED_OUT) {
    return { kind: "hidden", label: null }
  }
  if (status === MEMBERSHIP_STATUS.LOADING) {
    return { kind: "pending", label: "···" }
  }
  if (status === MEMBERSHIP_STATUS.PRO) {
    return { kind: "pro", label: "PRO" }
  }
  // FREE + lookup error: show FREE for header continuity (APIs stay fail-closed).
  if (status === MEMBERSHIP_STATUS.FREE || status === MEMBERSHIP_STATUS.ERROR) {
    return { kind: "free", label: "FREE" }
  }
  return { kind: "hidden", label: null }
}

/**
 * Map API JSON to UI status. Never trust client-supplied plan.
 * @param {{ plan?: unknown } | null | undefined} body
 * @returns {"free" | "pro"}
 */
export function membershipStatusFromApiBody(body) {
  const plan = typeof body?.plan === "string" ? body.plan.trim().toLowerCase() : ""
  return plan === "pro" ? MEMBERSHIP_STATUS.PRO : MEMBERSHIP_STATUS.FREE
}
