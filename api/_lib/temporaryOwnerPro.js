/**
 * TEMPORARY owner Pro access for the operating site.
 * Remove this module and the calls in the membership handlers
 * after Firebase custom claim role=operator is set.
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
