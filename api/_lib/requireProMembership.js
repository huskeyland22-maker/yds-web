/**
 * Server-side PRO gate for selected APIs.
 * Uses Firebase ID token + user_membership ledger only.
 * Never trusts accessTier, client plan/uid, or UI isPro.
 */

import { verifyFirebaseIdToken } from "./firebaseIdToken.js"
import {
  MembershipLookupError,
  isProMembership,
  resolveUserMembership,
} from "./userMembership.js"

/**
 * @param {unknown} req
 * @returns {string | null}
 */
export function readBearerToken(req) {
  const raw = String(req?.headers?.authorization ?? req?.headers?.Authorization ?? "")
  if (!raw.startsWith("Bearer ")) return null
  return raw.slice(7).trim() || null
}

/**
 * @typedef {{
 *   verifyFirebaseIdToken?: typeof verifyFirebaseIdToken
 *   resolveUserMembership?: typeof resolveUserMembership
 * }} RequireProDeps
 *
 * @typedef {{
 *   ok: true
 *   uid: string
 *   membership: import("./userMembership.js").MembershipResolution
 * } | {
 *   ok: false
 *   status: number
 *   body: Record<string, unknown>
 * }} RequireProResult
 */

/**
 * @param {unknown} req
 * @param {RequireProDeps} [deps]
 * @returns {Promise<RequireProResult>}
 */
export async function requireProMembership(req, deps = {}) {
  const verify = deps.verifyFirebaseIdToken ?? verifyFirebaseIdToken
  const resolve = deps.resolveUserMembership ?? resolveUserMembership

  const token = readBearerToken(req)
  if (!token) {
    return { ok: false, status: 401, body: { error: "missing_token" } }
  }

  let uid
  try {
    uid = await verify(token)
  } catch {
    return { ok: false, status: 401, body: { error: "invalid_token" } }
  }

  if (!uid || typeof uid !== "string") {
    return { ok: false, status: 401, body: { error: "invalid_token" } }
  }

  try {
    const membership = await resolve(uid)
    if (!isProMembership(membership)) {
      return {
        ok: false,
        status: 403,
        body: {
          error: "pro_required",
          plan: membership.plan,
          reason: membership.reason,
        },
      }
    }
    return { ok: true, uid, membership }
  } catch (e) {
    if (e instanceof MembershipLookupError && e.code === "supabase_not_configured") {
      return { ok: false, status: 503, body: { error: "supabase_not_configured" } }
    }
    console.error(
      "[requireProMembership] lookup failed",
      e instanceof MembershipLookupError ? e.code : "error",
    )
    return { ok: false, status: 500, body: { error: "membership_lookup_failed" } }
  }
}

/**
 * @param {import("http").ServerResponse & { status: (n: number) => { json: (b: unknown) => void } }} res
 * @param {Extract<RequireProResult, { ok: false }>} denied
 */
export function sendProMembershipDenied(res, denied) {
  return res.status(denied.status).json(denied.body)
}
