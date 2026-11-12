/**
 * GET /api/me-membership (hosted by portfolio-sync via ?ydsMode=me-membership)
 * Authorization: Bearer <Firebase ID token>
 *
 * Returns the caller's membership plan from the server ledger.
 * UID is taken only from the verified token — never from query/body.
 * No POST/PUT — clients cannot change plan here.
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
function readBearer(req) {
  const raw = String(req?.headers?.authorization ?? req?.headers?.Authorization ?? "")
  if (!raw.startsWith("Bearer ")) return null
  return raw.slice(7).trim() || null
}

/**
 * @param {import("http").IncomingMessage & { method?: string, body?: unknown, headers?: Record<string, string>, query?: Record<string, unknown> }} req
 * @param {import("http").ServerResponse & { status: (n: number) => { json: (b: unknown) => void }, setHeader: (k: string, v: string) => void }} res
 * @param {{
 *   verifyFirebaseAuthUser?: typeof verifyFirebaseAuthUser
 *   resolveUserMembership?: typeof resolveUserMembership
 * }} [deps]
 */
export async function handleMeMembership(req, res, deps = {}) {
  const verify = deps.verifyFirebaseAuthUser ?? deps.verifyFirebaseIdToken ?? verifyFirebaseAuthUser
  const resolve = deps.resolveUserMembership ?? resolveUserMembership

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "method_not_allowed" })
  }

  const token = readBearer(req)
  if (!token) {
    return res.status(401).json({ error: "missing_token" })
  }

  let profile
  try {
    profile = await verify(token)
  } catch (e) {
    return res.status(401).json({
      error: "invalid_token",
      message: e instanceof Error ? e.message : "invalid",
    })
  }

  const uid = typeof profile === "string" ? profile : profile?.uid
  const email = profile && typeof profile === "object" && typeof profile.email === "string" ? profile.email : ""
  const claims = profile && typeof profile === "object" ? profile.claims : {}
  if (!uid || typeof uid !== "string") {
    return res.status(401).json({ error: "invalid_token" })
  }

  try {
    let membership
    try {
      membership = await resolve(uid)
    } catch (lookupError) {
      if (!isTemporaryOwnerPro(uid, email)) throw lookupError
      membership = resolveMembershipFromRow(null)
    }
    membership = applyTemporaryOwnerPro(uid, email, membership)
    const access = resolveDetailAccess(membership, claims)
    return res.status(200).json({
      plan: membership.plan,
      status: membership.status,
      source: membership.source,
      updatedAt: membership.updatedAt,
      reason: membership.reason,
      audience: access.audience,
      detailAccess: access.detailAccess,
    })
  } catch (e) {
    if (e instanceof MembershipLookupError && e.code === "supabase_not_configured") {
      return res.status(503).json({ error: "supabase_not_configured" })
    }
    console.error("[me-membership] lookup failed", e instanceof MembershipLookupError ? e.code : "error")
    return res.status(500).json({
      error: "membership_lookup_failed",
    })
  }
}
