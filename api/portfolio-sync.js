/**
 * GET/PUT /api/portfolio-sync
 * Authorization: Bearer <Firebase ID token>
 *
 * Also hosts via vercel rewrite (Hobby serverless function cap):
 * - /api/trade-records-sync → ?ydsMode=trade-records
 * - /api/me-membership → ?ydsMode=me-membership
 */
import { verifyFirebaseIdToken } from "./_lib/firebaseIdToken.js"
import { isSupabaseConfigured, supabaseRest } from "./_lib/supabaseRest.js"
import { handleMeMembership } from "./_lib/meMembershipHandler.js"
import { handleTradeRecordsSync } from "./_lib/tradeRecordsSyncHandler.js"
import { mergePortfolioServerPut } from "../vite-project/src/content/ydsPortfolioCloudSync.js"

function readBearer(req) {
  const raw = String(req.headers?.authorization ?? "")
  if (!raw.startsWith("Bearer ")) return null
  return raw.slice(7).trim() || null
}

/** @param {{ query?: Record<string, unknown> }} req */
function resolveYdsMode(req) {
  const raw = req?.query?.ydsMode
  return typeof raw === "string" ? raw.trim() : ""
}

/**
 * @param {import("http").IncomingMessage & { method?: string, body?: unknown, headers?: Record<string, string>, query?: Record<string, unknown> }} req
 * @param {import("http").ServerResponse & { status: (n: number) => { json: (b: unknown) => void }, setHeader: (k: string, v: string) => void }} res
 */
/**
 * @param {Parameters<typeof handler>[0]} req
 * @param {Parameters<typeof handler>[1]} res
 * @param {{
 *   verifyFirebaseIdToken?: typeof verifyFirebaseIdToken
 *   isSupabaseConfigured?: typeof isSupabaseConfigured
 *   supabaseRest?: typeof supabaseRest
 * }} [deps]
 */
export default async function handler(req, res, deps = {}) {
  const verify = deps.verifyFirebaseIdToken ?? verifyFirebaseIdToken
  const configured = deps.isSupabaseConfigured ?? isSupabaseConfigured
  const rest = deps.supabaseRest ?? supabaseRest
  const mode = resolveYdsMode(req)

  // /api/me-membership → rewrite → ?ydsMode=me-membership
  if (mode === "me-membership") {
    return handleMeMembership(req, res)
  }

  // /api/trade-records-sync → rewrite → ?ydsMode=trade-records
  if (mode === "trade-records") {
    return handleTradeRecordsSync(req, res)
  }

  if (req.method !== "GET" && req.method !== "PUT") {
    res.setHeader("Allow", "GET, PUT")
    return res.status(405).json({ error: "method_not_allowed" })
  }

  const token = readBearer(req)
  if (!token) return res.status(401).json({ error: "missing_token" })

  let uid
  try {
    uid = await verify(token)
  } catch (e) {
    return res.status(401).json({ error: "invalid_token", message: e instanceof Error ? e.message : "invalid" })
  }

  if (!configured()) {
    return res.status(503).json({ error: "supabase_not_configured" })
  }

  const pathBase = `user_portfolio?firebase_uid=eq.${encodeURIComponent(uid)}`

  if (req.method === "GET") {
    try {
      const rows = await rest(`${pathBase}&select=firebase_uid,trades,cash_balance,revision,updated_at`, {
        method: "GET",
      })
      const row = Array.isArray(rows) ? rows[0] : null
      return res.status(200).json({ portfolio: row ?? null, syncMode: row ? "account" : "empty" })
    } catch (e) {
      console.error("[portfolio-sync] GET failed", e)
      return res.status(500).json({ error: "fetch_failed" })
    }
  }

  const body = req.body ?? {}
  let existing = null
  try {
    const rows = await rest(`${pathBase}&select=firebase_uid,trades,cash_balance,revision,updated_at`, {
      method: "GET",
    })
    existing = Array.isArray(rows) ? rows[0] : null
  } catch (e) {
    console.error("[portfolio-sync] PUT read failed — refusing replace", e)
    return res.status(500).json({ error: "save_failed" })
  }

  const merged = mergePortfolioServerPut({
    existingTrades: existing?.trades,
    existingCash: Number(existing?.cash_balance) || 0,
    requestTrades: body.trades,
    requestCash: body.cash_balance,
    requestCashUpdatedAt: body.cash_updated_at,
  })
  const revision = Number(body.revision)
  const payload = {
    firebase_uid: uid,
    trades: merged.storedTrades,
    cash_balance: merged.cashBalance,
    revision: Number.isFinite(revision) ? Math.round(revision) : Date.now(),
  }

  try {
    const saved = await rest("user_portfolio?on_conflict=firebase_uid", {
      method: "POST",
      body: payload,
      prefer: "resolution=merge-duplicates,return=representation",
    })
    const row = Array.isArray(saved) ? saved[0] : saved
    return res.status(200).json({
      portfolio: row ?? payload,
      syncMode: "account",
      omittedWithoutId: merged.omittedWithoutId,
    })
  } catch (e) {
    console.error("[portfolio-sync] PUT failed", e)
    return res.status(500).json({ error: "save_failed" })
  }
}
