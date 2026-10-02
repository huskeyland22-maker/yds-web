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
  deletedRecordIds: Object.freeze([]),
})

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
function normalizeDeletedRecordIds(raw) {
  if (!Array.isArray(raw)) return []
  /** @type {string[]} */
  const out = []
  const seen = new Set()
  for (const id of raw) {
    if (typeof id !== "string") continue
    const trimmed = id.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out
}

/**
 * @param {Record<string, object[]>} records
 * @param {string[]} deletedRecordIds
 */
function stripDeletedRecords(records, deletedRecordIds) {
  const deleted = new Set(deletedRecordIds)
  /** @type {Record<string, object[]>} */
  const next = {}
  for (const [key, list] of Object.entries(records)) {
    const kept = list.filter((row) => !deleted.has(row.id))
    if (kept.length) next[key] = kept
  }
  return next
}

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
 * Preserve localStorage `yds.tradeRecords.v1` shape: { version, records: { "dbb:SYM": [...] }, deletedRecordIds }
 * Tombstoned ids are removed from live rows. Tombstones are not purged.
 * @param {unknown} raw
 * @returns {{ version: 1, records: Record<string, object[]>, deletedRecordIds: string[] }}
 */
export function sanitizeTradeRecordsStore(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { version: 1, records: {}, deletedRecordIds: [] }
  }
  const src = /** @type {Record<string, unknown>} */ (raw)
  const nested =
    src.records && typeof src.records === "object" && !Array.isArray(src.records)
      ? /** @type {Record<string, unknown>} */ (src.records)
      : {}
  const deletedRecordIds = normalizeDeletedRecordIds(src.deletedRecordIds)

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
  return { version: 1, records: stripDeletedRecords(records, deletedRecordIds), deletedRecordIds }
}

/**
 * Incoming live rows replace the previous live rows, but tombstones only grow.
 * A stale client cannot recreate an id that either side has deleted.
 * @param {unknown} previous
 * @param {unknown} incoming
 */
export function mergeStoredTradeRecords(previous, incoming) {
  const prev = sanitizeTradeRecordsStore(previous)
  const next = sanitizeTradeRecordsStore(incoming)
  const deletedRecordIds = normalizeDeletedRecordIds([...prev.deletedRecordIds, ...next.deletedRecordIds])
  return {
    version: 1,
    records: stripDeletedRecords(next.records, deletedRecordIds),
    deletedRecordIds,
  }
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
        return res.status(200).json(okPayload({ version: 1, records: {}, deletedRecordIds: [] }, 0, null, "empty"))
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
  const revisionRaw = Number(body.revision)
  const revision = Number.isFinite(revisionRaw) ? Math.round(revisionRaw) : Date.now()

  // Read the current row once so tombstones survive a stale replace, and so
  // baseRevision can still reject a conflicting write.
  let existing = null
  try {
    const existingRows = await rest(`${pathBase}&select=records,revision,firebase_uid`, { method: "GET" })
    existing = Array.isArray(existingRows) ? existingRows[0] : null
  } catch (e) {
    console.error("[trade-records-sync] revision check failed", e)
    return res.status(500).json({ error: "fetch_failed" })
  }
  if (existing && String(existing.firebase_uid) !== uid) {
    return res.status(403).json({ error: "forbidden" })
  }
  if (body.baseRevision != null && body.baseRevision !== "" && existing) {
    const serverRev = Number(existing.revision)
    const baseRev = Number(body.baseRevision)
    if (Number.isFinite(serverRev) && Number.isFinite(baseRev) && serverRev !== baseRev) {
      return res.status(409).json({
        error: "revision_conflict",
        revision: serverRev,
      })
    }
  }

  const records = mergeStoredTradeRecords(existing?.records, body.records)

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
