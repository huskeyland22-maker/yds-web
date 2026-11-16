/**
 * TEMPORARY owner Pro access for the operating site.
 *
 * Preview verification branch (`ops/remove-temporary-owner-pro-preview`):
 * This module is kept on disk but is NO LONGER imported by meMembershipHandler
 * or requireProMembership. Formal access is ledger PRO or Firebase role=operator.
 *
 * After Preview proves Owner me-membership returns audience=operator without
 * this bypass, delete this file and remaining unit coverage in a later step.
 *
 * Does not write user_membership and does not apply to any other account.
 */

const TEMPORARY_OWNER_PRO_UID = "9mm60sKonGc3NoSC71lQG2Vp2jG2"
const TEMPORARY_OWNER_PRO_EMAIL = "huskeyland22@gmail.com"

/**
 * Verified token identity must match both the UID and the email.
 * @param {unknown} uid
 * @param {unknown} email
 * @returns {boolean}
 */
export function isTemporaryOwnerPro(uid, email) {
  return (
    String(uid ?? "").trim() === TEMPORARY_OWNER_PRO_UID &&
    String(email ?? "").trim().toLowerCase() === TEMPORARY_OWNER_PRO_EMAIL
  )
}

/**
 * In-memory response only. A real active PRO row is left unchanged.
 * @param {unknown} uid
 * @param {unknown} email
 * @param {import("./userMembership.js").MembershipResolution | null | undefined} membership
 * @returns {import("./userMembership.js").MembershipResolution | null | undefined}
 */
export function applyTemporaryOwnerPro(uid, email, membership) {
  if (!isTemporaryOwnerPro(uid, email) || !membership) return membership
  if (membership.plan === "pro" && membership.status === "active") return membership
  return {
    ...membership,
    plan: "pro",
    status: "active",
    reason: "temporary_owner_pro",
  }
}
