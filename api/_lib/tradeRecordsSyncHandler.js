/**
 * GET/PUT trade records sync — Firebase UID → Supabase user_trade_records.
 * Mounted at /api/trade-records-sync (rewrite → portfolio-sync?ydsMode=trade-records).
 * UID always comes from verified Firebase ID token — never from request body.
 */

import { verifyFirebaseIdToken } from "./firebaseIdToken.js"
import { isSupabaseConfigured, supabaseRest } from "./supabaseRest.js"

export const EMPTY_TRADE_RECORDS_STORE = Object.freeze({
  version: 1,
  records: Object.freeze({}),
})

/**
 * @param {unknown} req
 * @returns {string | null}
 */
export function readBearer(req) {
  const raw = String(req?.headers?.authorization ?? req?.headers?.Authorization ?? "")
  if (!raw.startsWith("Bearer ")) return null
  return raw.slice(7).trim() || null
}

/**
 * Preserve localStorage `yds.tradeRecords.v1` shape: { version, records: { "dbb:SYM": [...] } }
 * @param {unknown} raw
 * @returns {{ version: 1, records: Record<string, object[]> }}
 */
export function sanitizeTradeRecordsStore(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { version: 1, records: {} }
  }
  const src = /** @type {Record<string, unknown>} */ (raw)
  const nested =
    src.records && typeof src.records === "object" && !Array.isArray(src.records)
      ? /** @type {Record<string, unknown>} */ (src.records)
      : {}

  /** @type {Record<string, object[]>} */
  const records = {}
  for (const [key, list] of Object.entries(nested)) {
    if (typeof key !== "string" || !key) continue
    if (!Array.isArray(list)) continue
    const cleaned = list.filter(
      (r) => r && typeof r === "object" && !Array.isArray(r) && typeof r.id === "string" && r.id,
    )
    if (cleaned.length) records[key] = cleaned
  }
  return { version: 1, records }
}

/**
 * @param {number} revision
 * @param {unknown} updatedAt
 * @param {{ version: 1, records: Record<string, object[]> }} records
 * @param {"account" | "empty"} syncMode
 */
function okPayload(records, revision, updatedAt, syncMode) {
  return {
    records,
    revision: Number.isFinite(Number(revision)) ? Number(revision) : 0,
    updatedAt: updatedAt == null ? null : String(updatedAt),
    syncMode,
  }
}

/**
 * @typedef {{
 *   verifyFirebaseIdToken?: typeof verifyFirebaseIdToken
 *   isSupabaseConfigured?: typeof isSupabaseConfigured
 *   supabaseRest?: typeof supabaseRest
 * }} TradeRecordsSyncDeps
 */

/**
 * @param {import("http").IncomingMessage & { method?: string, body?: unknown, headers?: Record<string, string>, query?: Record<string, unknown> }} req
 * @param {import("http").ServerResponse & { status: (n: number) => { json: (b: unknown) => void }, setHeader: (k: string, v: string) => void }} res
 * @param {TradeRecordsSyncDeps} [deps]
 */
export async function handleTradeRecordsSync(req, res, deps = {}) {
  const verify = deps.verifyFirebaseIdToken || verifyFirebaseIdToken
  const configured = deps.isSupabaseConfigured || isSupabaseConfigured
  const rest = deps.supabaseRest || supabaseRest

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
  if (!uid || typeof uid !== "string") {
    return res.status(401).json({ error: "invalid_token" })
  }

  if (!configured()) {
    return res.status(503).json({ error: "supabase_not_configured" })
  }

  // Scope every query to token UID only — ignore any body.firebase_uid.
  const pathBase = `user_trade_records?firebase_uid=eq.${encodeURIComponent(uid)}`

  if (req.method === "GET") {
    try {
      const rows = await rest(
        `${pathBase}&select=id,firebase_uid,records,revision,updated_at`,
        { method: "GET" },
      )
      const row = Array.isArray(rows) ? rows[0] : null
      if (!row) {
        return res.status(200).json(okPayload({ version: 1, records: {} }, 0, null, "empty"))
      }
      // Defense: never return another user's row even if PostgREST misbehaves.
      if (String(row.firebase_uid) !== uid) {
        return res.status(403).json({ error: "forbidden" })
      }
      return res.status(200).json(
        okPayload(
          sanitizeTradeRecordsStore(row.records),
          row.revision,
          row.updated_at,
          "account",
        ),
      )
    } catch (e) {
      console.error("[trade-records-sync] GET failed", e)
      return res.status(500).json({ error: "fetch_failed" })
    }
  }

  const body = req.body && typeof req.body === "object" ? req.body : {}
  const records = sanitizeTradeRecordsStore(body.records)
  const revisionRaw = Number(body.revision)
  const revision = Number.isFinite(revisionRaw) ? Math.round(revisionRaw) : Date.now()

  // Optional minimal optimistic concurrency (portfolio-style revision field).
  // If client sends baseRevision and it does not match server, reject.
  if (body.baseRevision != null && body.baseRevision !== "") {
    try {
      const existingRows = await rest(`${pathBase}&select=revision,firebase_uid`, { method: "GET" })
      const existing = Array.isArray(existingRows) ? existingRows[0] : null
      if (existing && String(existing.firebase_uid) === uid) {
        const serverRev = Number(existing.revision)
        const baseRev = Number(body.baseRevision)
        if (Number.isFinite(serverRev) && Number.isFinite(baseRev) && serverRev !== baseRev) {
          return res.status(409).json({
            error: "revision_conflict",
            revision: serverRev,
          })
        }
      }
    } catch (e) {
      console.error("[trade-records-sync] revision check failed", e)
      return res.status(500).json({ error: "fetch_failed" })
    }
  }

  const payload = {
    firebase_uid: uid,
    records,
    revision,
  }

  try {
    const saved = await rest("user_trade_records?on_conflict=firebase_uid", {
      method: "POST",
      body: payload,
      prefer: "resolution=merge-duplicates,return=representation",
    })
    const row = Array.isArray(saved) ? saved[0] : saved
    if (row && String(row.firebase_uid) !== uid) {
      return res.status(403).json({ error: "forbidden" })
    }
    return res.status(200).json(
      okPayload(
        sanitizeTradeRecordsStore(row?.records ?? records),
        row?.revision ?? revision,
        row?.updated_at ?? null,
        "account",
      ),
    )
  } catch (e) {
    console.error("[trade-records-sync] PUT failed", e)
    return res.status(500).json({ error: "save_failed" })
  }
}
