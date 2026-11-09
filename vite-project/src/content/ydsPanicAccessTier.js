/**
 * Panic JSON `accessTier` is a legacy payload-shape marker (Flask free vs full fields).
 * It is NOT YDS billing membership.
 *
 * Billing / UI PRO gates must use:
 * - useMembership().isPro
 * - GET /api/me-membership → plan
 * - api/_lib/userMembership.js
 *
 * Values:
 * - "free" — stripped / limited metric payload (Flask without PRO_API_KEY)
 * - "full" — complete metric object (formerly mislabeled "pro")
 */

/** @typedef {"free" | "full"} PanicAccessTier */

/**
 * @param {unknown} raw
 * @returns {PanicAccessTier}
 */
export function normalizePanicAccessTier(raw) {
  if (raw === "free") return "free"
  // Legacy stamped "pro" meant "full metric fields", not membership PRO.
  return "full"
}
