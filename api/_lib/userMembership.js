/**
 * Resolve FREE/PRO membership from server-only Supabase ledger `user_membership`.
 *
 * Rules:
 * - Identity comes from a verified Firebase UID (caller must verify the ID token).
 * - Missing row → FREE (normal).
 * - status !== "active" → FREE (normal).
 * - plan === "pro" and active → PRO.
 * - Lookup / config failures must NOT be silently treated as FREE.
 * - Never use panic `accessTier`, UI `isPro`, or client-supplied plan/uid.
 * - Never log secrets or auth tokens.
 */

import { isSupabaseConfigured, supabaseRest } from "./supabaseRest.js"

export const MEMBERSHIP_PLANS = Object.freeze({ FREE: "free", PRO: "pro" })

/**
 * @typedef {"free" | "pro"} MembershipPlan
 * @typedef {"none" | "active" | "revoked" | string} MembershipStatus
 *
 * @typedef {{
 *   plan: MembershipPlan
 *   status: MembershipStatus
 *   source: string | null
 *   updatedAt: string | null
 *   reason: "missing_row" | "inactive" | "plan_free" | "plan_pro"
 * }} MembershipResolution
 */

export class MembershipLookupError extends Error {
  /**
   * @param {string} code
   * @param {string} [message]
   */
  constructor(code, message) {
    super(message || code)
    this.name = "MembershipLookupError"
    this.code = code
  }
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : ""
}

/**
 * Pure resolution from a ledger row (or null). Does not touch the network.
 * @param {Record<string, unknown> | null | undefined} row
 * @returns {MembershipResolution}
 */
export function resolveMembershipFromRow(row) {
  if (!row || typeof row !== "object") {
    return {
      plan: MEMBERSHIP_PLANS.FREE,
      status: "none",
      source: null,
      updatedAt: null,
      reason: "missing_row",
    }
  }

  const status = asTrimmedString(row.status) || "active"
  const source = asTrimmedString(row.source) || null
  const updatedAt = row.updated_at == null ? null : String(row.updated_at)
  const planRaw = asTrimmedString(row.plan).toLowerCase()

  if (status !== "active") {
    return {
      plan: MEMBERSHIP_PLANS.FREE,
      status,
      source,
      updatedAt,
      reason: "inactive",
    }
  }

  if (planRaw === MEMBERSHIP_PLANS.PRO) {
    return {
      plan: MEMBERSHIP_PLANS.PRO,
      status: "active",
      source,
      updatedAt,
      reason: "plan_pro",
    }
  }

  return {
    plan: MEMBERSHIP_PLANS.FREE,
    status: "active",
    source,
    updatedAt,
    reason: "plan_free",
  }
}

/**
 * @typedef {{
 *   isSupabaseConfigured?: typeof isSupabaseConfigured
 *   supabaseRest?: typeof supabaseRest
 * }} UserMembershipDeps
 */

/**
 * Look up membership for a verified Firebase UID.
 * Throws MembershipLookupError on config/query failure (do not treat as FREE).
 *
 * @param {string} firebaseUid
 * @param {UserMembershipDeps} [deps]
 * @returns {Promise<MembershipResolution>}
 */
export async function resolveUserMembership(firebaseUid, deps = {}) {
  const uid = asTrimmedString(firebaseUid)
  if (!uid) {
    return resolveMembershipFromRow(null)
  }

  const configured = deps.isSupabaseConfigured ?? isSupabaseConfigured
  const rest = deps.supabaseRest ?? supabaseRest

  if (!configured()) {
    throw new MembershipLookupError("supabase_not_configured", "Supabase is not configured")
  }

  // Staging ledger columns (no `note`): firebase_uid, plan, status, source, created_at, updated_at.
  // `note` is not required for FREE/PRO resolution and must not be selected.
  const path =
    `user_membership?firebase_uid=eq.${encodeURIComponent(uid)}` +
    `&select=firebase_uid,plan,status,source,updated_at`

  let rows
  try {
    rows = await rest(path, { method: "GET" })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "membership_lookup_failed"
    // Do not include tokens or keys in the error message.
    throw new MembershipLookupError("membership_lookup_failed", msg)
  }

  const row = Array.isArray(rows) ? rows[0] : null
  if (row && asTrimmedString(row.firebase_uid) && asTrimmedString(row.firebase_uid) !== uid) {
    // Defense: never trust a mismatched row as PRO.
    throw new MembershipLookupError("membership_uid_mismatch", "membership row uid mismatch")
  }

  return resolveMembershipFromRow(row)
}

/**
 * @param {MembershipResolution} resolution
 * @returns {boolean}
 */
export function isProMembership(resolution) {
  return resolution?.plan === MEMBERSHIP_PLANS.PRO
}
