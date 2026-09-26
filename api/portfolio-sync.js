/**
 * GET/PUT /api/portfolio-sync
 * Authorization: Bearer <Firebase ID token>
 *
 * Also hosts /api/trade-records-sync via vercel rewrite (?ydsMode=trade-records)
 * to stay within the Hobby serverless function cap.
 */
import { verifyFirebaseIdToken } from "./_lib/firebaseIdToken.js"
import { isSupabaseConfigured, supabaseRest } from "./_lib/supabaseRest.js"
import { handleTradeRecordsSync } from "./_lib/tradeRecordsSyncHandler.js"

function readBearer(req) {
  const raw = String(req.headers?.authorization ?? "")
  if (!raw.startsWith("Bearer ")) return null
  return raw.slice(7).trim() || null
}

/** @param {unknown} trades */
function sanitizeTrades(trades) {
  if (!Array.isArray(trades)) return []
  return trades.filter((t) => t && typeof t.id === "string")
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
export default async function handler(req, res) {
  // /api/trade-records-sync → rewrite → ?ydsMode=trade-records
  if (resolveYdsMode(req) === "trade-records") {
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
    uid = await verifyFirebaseIdToken(token)
  } catch (e) {
    return res.status(401).json({ error: "invalid_token", message: e instanceof Error ? e.message : "invalid" })
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: "supabase_not_configured" })
  }

  const pathBase = `user_portfolio?firebase_uid=eq.${encodeURIComponent(uid)}`

  if (req.method === "GET") {
    try {
      const rows = await supabaseRest(`${pathBase}&select=firebase_uid,trades,cash_balance,revision,updated_at`, {
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
  const trades = sanitizeTrades(body.trades)
  const cashBalance = Number(body.cash_balance)
  const revision = Number(body.revision)
  const payload = {
    firebase_uid: uid,
    trades,
    cash_balance: Number.isFinite(cashBalance) ? cashBalance : 0,
    revision: Number.isFinite(revision) ? Math.round(revision) : Date.now(),
  }

  try {
    const saved = await supabaseRest("user_portfolio?on_conflict=firebase_uid", {
      method: "POST",
      body: payload,
      prefer: "resolution=merge-duplicates,return=representation",
    })
    const row = Array.isArray(saved) ? saved[0] : saved
    return res.status(200).json({ portfolio: row ?? payload, syncMode: "account" })
  } catch (e) {
    console.error("[portfolio-sync] PUT failed", e)
    return res.status(500).json({ error: "save_failed" })
  }
}
