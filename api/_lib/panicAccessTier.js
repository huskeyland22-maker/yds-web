/**
 * Panic JSON `accessTier` — legacy payload-shape marker, NOT billing membership.
 * UI / API PRO gates must use user_membership / requireProMembership (P4), not this field.
 *
 * @param {unknown} raw
 * @returns {"free" | "full"}
 */
export function normalizePanicAccessTier(raw) {
  if (raw === "free") return "free"
  // Legacy "pro" on metric payloads meant full fields, not plan === "pro".
  return "full"
}
