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
 * Map API JSON to UI status. Never trust client-supplied plan.
 * @param {{ plan?: unknown } | null | undefined} body
 * @returns {"free" | "pro"}
 */
export function membershipStatusFromApiBody(body) {
  const plan = typeof body?.plan === "string" ? body.plan.trim().toLowerCase() : ""
  return plan === "pro" ? MEMBERSHIP_STATUS.PRO : MEMBERSHIP_STATUS.FREE
}
