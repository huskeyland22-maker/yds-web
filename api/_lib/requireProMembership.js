/**
 * Server-side PRO gate for selected APIs.
 * Uses Firebase ID token + user_membership ledger only.
 * Never trusts accessTier, client plan/uid, or UI isPro.
 */

import { verifyFirebaseAuthUser } from "./firebaseIdToken.js"
import {
  MembershipLookupError,
  resolveDetailAccess,
  resolveMembershipFromRow,
  resolveUserMembership,
} from "./userMembership.js"
import { applyTemporaryOwnerPro, isTemporaryOwnerPro } from "./temporaryOwnerPro.js"

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
 *   verifyFirebaseIdToken?: (token: string) => Promise<string | { uid?: string, claims?: unknown }>
 *   verifyFirebaseAuthUser?: typeof verifyFirebaseAuthUser
 *   resolveUserMembership?: typeof resolveUserMembership
 * }} RequireProDeps
 *
 * @typedef {{
 *   ok: true
 *   uid: string
 *   audience: "pro" | "operator"
 *   membership: import("./userMembership.js").MembershipResolution
 * } | {
 *   ok: false
 *   status: number
 *   body: Record<string, unknown>
 * }} RequireProResult
 */

/**
 * @param {string | { uid?: string, claims?: unknown } | null | undefined} result
 * @returns {{ uid: string, email: string, claims: unknown }}
 */
function identityFromVerifyResult(result) {
  if (typeof result === "string") return { uid: result, email: "", claims: {} }
  if (result && typeof result === "object") {
    const uid = typeof result.uid === "string" ? result.uid : ""
    const email = typeof result.email === "string" ? result.email : ""
    return { uid, email, claims: result.claims ?? {} }
  }
  return { uid: "", email: "", claims: {} }
}

/**
 * @param {unknown} req
 * @param {RequireProDeps} [deps]
 * @returns {Promise<RequireProResult>}
 */
export async function requireProMembership(req, deps = {}) {
  const resolve = deps.resolveUserMembership ?? resolveUserMembership

  const token = readBearerToken(req)
  if (!token) {
    return { ok: false, status: 401, body: { error: "missing_token" } }
  }

  let identity
  try {
    if (deps.verifyFirebaseAuthUser) {
      identity = identityFromVerifyResult(await deps.verifyFirebaseAuthUser(token))
    } else if (deps.verifyFirebaseIdToken) {
      identity = identityFromVerifyResult(await deps.verifyFirebaseIdToken(token))
    } else {
      identity = identityFromVerifyResult(await verifyFirebaseAuthUser(token))
    }
  } catch {
    return { ok: false, status: 401, body: { error: "invalid_token" } }
  }

  if (!identity.uid) {
    return { ok: false, status: 401, body: { error: "invalid_token" } }
  }

  try {
    let membership
    try {
      membership = await resolve(identity.uid)
    } catch (lookupError) {
      if (!isTemporaryOwnerPro(identity.uid, identity.email)) throw lookupError
      membership = resolveMembershipFromRow(null)
    }
    membership = applyTemporaryOwnerPro(identity.uid, identity.email, membership)
    const access = resolveDetailAccess(membership, identity.claims)
    if (!access.detailAccess || access.audience === "free") {
      return {
        ok: false,
        status: 403,
        body: {
          error: "pro_required",
          plan: membership.plan,
          reason: membership.reason,
          audience: "free",
        },
      }
    }
    return { ok: true, uid: identity.uid, audience: access.audience, membership }
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
