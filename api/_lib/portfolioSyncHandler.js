/**
 * GET/PUT user portfolio sync — Firebase UID → Supabase user_portfolio.
 *
 * Revision rules (Phase B):
 * - `revision` is a monotonic server counter (not Date.now(), not cash amounts).
 * - PUT must send `baseRevision` matching the last GET (null/0 only for first create).
 * - Successful PUT sets revision = previous + 1 (create → 1).
 * - Mismatch → 409, row unchanged.
 * - Create uses INSERT (no upsert). Duplicate key → 409.
 * - Update uses PATCH filtered by firebase_uid AND revision=baseRevision (optimistic lock).
 */

import { verifyFirebaseIdToken } from "./firebaseIdToken.js"
import { isSupabaseConfigured, supabaseRest } from "./supabaseRest.js"

/** @param {unknown} trades */
function sanitizeTrades(trades) {
  if (!Array.isArray(trades)) return []
  return trades.filter((t) => t && typeof t.id === "string")
}

function readBearer(req) {
  const raw = String(req.headers?.authorization ?? "")
  if (!raw.startsWith("Bearer ")) return null
  return raw.slice(7).trim() || null
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
export function parseBaseRevision(value) {
  if (value == null || value === "") return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.round(n)
}

/**
 * @param {import("http").IncomingMessage & { method?: string, body?: unknown, headers?: Record<string, string> }} req
 * @param {import("http").ServerResponse & { status: (n: number) => { json: (b: unknown) => void }, setHeader: (k: string, v: string) => void }} res
 * @param {{
 *   verifyFirebaseIdToken?: typeof verifyFirebaseIdToken
 *   isSupabaseConfigured?: typeof isSupabaseConfigured
 *   supabaseRest?: typeof supabaseRest
 * }} [deps]
 */
export async function handlePortfolioSync(req, res, deps = {}) {
  const verify = deps.verifyFirebaseIdToken ?? verifyFirebaseIdToken
  const configured = deps.isSupabaseConfigured ?? isSupabaseConfigured
  const rest = deps.supabaseRest ?? supabaseRest

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
    return res.status(401).json({
      error: "invalid_token",
      message: e instanceof Error ? e.message : "invalid",
    })
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

  const body = req.body && typeof req.body === "object" ? req.body : {}
  const trades = sanitizeTrades(body.trades)
  const cashBalance = Number(body.cash_balance)
  const safeCash = Number.isFinite(cashBalance) ? cashBalance : 0
  const baseRevision = parseBaseRevision(body.baseRevision)

  let existing = null
  try {
    const existingRows = await rest(`${pathBase}&select=firebase_uid,trades,cash_balance,revision,updated_at`, {
      method: "GET",
    })
    existing = Array.isArray(existingRows) ? existingRows[0] : null
  } catch (e) {
    console.error("[portfolio-sync] revision check failed", e)
    return res.status(500).json({ error: "fetch_failed" })
  }

  if (existing && String(existing.firebase_uid) !== uid) {
    return res.status(403).json({ error: "forbidden" })
  }

  // --- Create path (no row yet) ---
  if (!existing) {
    if (baseRevision != null && baseRevision !== 0) {
      // Client thought a row existed — treat as conflict / re-fetch.
      return res.status(409).json({
        error: "revision_conflict",
        revision: 0,
        portfolio: null,
        message: "expected_existing_row",
      })
    }

    const payload = {
      firebase_uid: uid,
      trades,
      cash_balance: safeCash,
      revision: 1,
    }

    try {
      // INSERT only — no on_conflict upsert (concurrent create → unique violation).
      const saved = await rest("user_portfolio", {
        method: "POST",
        body: payload,
        prefer: "return=representation",
      })
      const row = Array.isArray(saved) ? saved[0] : saved
      if (row && String(row.firebase_uid) !== uid) {
        return res.status(403).json({ error: "forbidden" })
      }
      return res.status(200).json({ portfolio: row ?? payload, syncMode: "account" })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // Race: another create won the primary key.
      if (/\b409\b|duplicate|unique|conflict/i.test(msg)) {
        let winner = null
        try {
          const rows = await rest(`${pathBase}&select=firebase_uid,trades,cash_balance,revision,updated_at`, {
            method: "GET",
          })
          winner = Array.isArray(rows) ? rows[0] : null
        } catch {
          /* ignore */
        }
        return res.status(409).json({
          error: "revision_conflict",
          revision: Number(winner?.revision) || 1,
          portfolio: winner,
          message: "create_race",
        })
      }
      console.error("[portfolio-sync] create failed", e)
      return res.status(500).json({ error: "save_failed" })
    }
  }

  // --- Update path ---
  const serverRev = Number(existing.revision)
  const safeServerRev = Number.isFinite(serverRev) ? Math.round(serverRev) : 0

  if (baseRevision == null || baseRevision !== safeServerRev) {
    return res.status(409).json({
      error: "revision_conflict",
      revision: safeServerRev,
      portfolio: existing,
    })
  }

  const nextRevision = safeServerRev + 1
  const patchBody = {
    trades,
    cash_balance: safeCash,
    revision: nextRevision,
  }

  try {
    // Optimistic lock: only update if revision still equals baseRevision.
    const saved = await rest(
      `user_portfolio?firebase_uid=eq.${encodeURIComponent(uid)}&revision=eq.${encodeURIComponent(String(safeServerRev))}`,
      {
        method: "PATCH",
        body: patchBody,
        prefer: "return=representation",
      },
    )
    const row = Array.isArray(saved) ? saved[0] : saved
    if (!row) {
      // 0 rows matched — lost the race to another writer.
      let latest = existing
      try {
        const rows = await rest(`${pathBase}&select=firebase_uid,trades,cash_balance,revision,updated_at`, {
          method: "GET",
        })
        latest = Array.isArray(rows) ? rows[0] : existing
      } catch {
        /* keep existing snapshot */
      }
      return res.status(409).json({
        error: "revision_conflict",
        revision: Number(latest?.revision) || safeServerRev,
        portfolio: latest,
        message: "patch_race",
      })
    }
    if (String(row.firebase_uid) !== uid) {
      return res.status(403).json({ error: "forbidden" })
    }
    return res.status(200).json({ portfolio: row, syncMode: "account" })
  } catch (e) {
    console.error("[portfolio-sync] update failed", e)
    return res.status(500).json({ error: "save_failed" })
  }
}
