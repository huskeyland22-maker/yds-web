/**
 * TEMPORARY owner Pro access for the operating site.
 * Remove this module and the call in resolveUserMembership
 * after Firebase custom claim role=operator is set.
 * Does not write user_membership and does not apply to any other UID.
 */

const TEMPORARY_OWNER_PRO_UID = "9mm60sKonGc3NoSC71lQG2Vp2jG2"

/**
 * @param {unknown} uid
 * @returns {boolean}
 */
export function isTemporaryOwnerProUid(uid) {
  return String(uid ?? "").trim() === TEMPORARY_OWNER_PRO_UID
}

/**
 * In-memory response only. A real active PRO row is left unchanged.
 * @param {unknown} uid
 * @param {import("./userMembership.js").MembershipResolution} membership
 * @returns {import("./userMembership.js").MembershipResolution}
 */
export function applyTemporaryOwnerPro(uid, membership) {
  if (!isTemporaryOwnerProUid(uid) || !membership) return membership
  if (membership.plan === "pro" && membership.status === "active") return membership
  return {
    ...membership,
    plan: "pro",
    status: "active",
    reason: "temporary_owner_pro",
  }
}
