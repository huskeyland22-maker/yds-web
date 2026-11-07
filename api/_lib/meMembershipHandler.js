/**
 * GET /api/me-membership (hosted by portfolio-sync via ?ydsMode=me-membership)
 * Authorization: Bearer <Firebase ID token>
 *
 * Returns the caller's membership plan from the server ledger.
 * UID is taken only from the verified token — never from query/body.
 * No POST/PUT — clients cannot change plan here.
 */

import { verifyFirebaseIdToken } from "./firebaseIdToken.js"
import {
  MembershipLookupError,
  resolveUserMembership,
} from "./userMembership.js"

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
 *   verifyFirebaseIdToken?: typeof verifyFirebaseIdToken
 *   resolveUserMembership?: typeof resolveUserMembership
 * }} [deps]
 */
export async function handleMeMembership(req, res, deps = {}) {
  const verify = deps.verifyFirebaseIdToken ?? verifyFirebaseIdToken
  const resolve = deps.resolveUserMembership ?? resolveUserMembership

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "method_not_allowed" })
  }

  const token = readBearer(req)
  if (!token) {
    return res.status(401).json({ error: "missing_token" })
  }

  let uid
  try {
    uid = await verify(token)
  } catch (e) {
    return res.status(401).json({
      error: "invalid_token",
      message: e instanceof Error ? e.message : "invalid",
    })
  }

  if (!uid || typeof uid !== "string") {
    return res.status(401).json({ error: "invalid_token" })
  }

  try {
    const membership = await resolve(uid)
    return res.status(200).json({
      plan: membership.plan,
      status: membership.status,
      source: membership.source,
      updatedAt: membership.updatedAt,
      reason: membership.reason,
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
