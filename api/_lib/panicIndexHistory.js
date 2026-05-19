import { supabaseRest } from "./supabaseRest.js"
import {
  normalizePanicPayload,
  panicIndexHistoryRowFromSnapshot,
  resolvePanicTradeDate,
  snapshotHasRequiredHistoryMetrics,
} from "./panicSnapshot.js"

/** @param {string} isoOrDate */
export function calendarDateFromPayload(body) {
  const u = body?.updatedAt ?? body?.updated_at
  if (typeof u === "string" && /^\d{4}-\d{2}-\d{2}/.test(u)) return u.slice(0, 10)
  return new Date().toISOString().slice(0, 10)
}

/**
 * @param {Record<string, unknown>} body
 * @param {string} [tradeDate] YYYY-MM-DD
 */
export function panicIndexHistoryRowFromPayload(body, tradeDate, opts = {}) {
  const snap = normalizePanicPayload(body, { tradeDate, source: opts.source })
  return panicIndexHistoryRowFromSnapshot(snap)
}

export function panicIndexHistoryRowToClient(row) {
  if (!row || typeof row !== "object") return null
  const dateStr = String(row.date ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null
  const pick = (k) => {
    const n = Number(row[k])
    return Number.isFinite(n) ? n : null
  }
  return {
    date: dateStr,
    vix: pick("vix"),
    vxn: pick("vxn"),
    fearGreed: pick("fear_greed"),
    move: pick("move"),
    bofa: pick("bofa"),
    skew: pick("skew"),
    hyOas: pick("hy_oas") ?? pick("high_yield"),
    highYield: pick("high_yield") ?? pick("hy_oas"),
    putCall: pick("put_call"),
    gsSentiment: pick("gs_sentiment") ?? pick("gs_bb"),
    gsBullBear: pick("gs_bb") ?? pick("gs_sentiment"),
    createdAt: row.created_at ?? row.updated_at ?? null,
  }
}

function rowHasRequiredHistoryMetrics(row) {
  const snap = {
    vix: row.vix,
    fearGreed: row.fear_greed,
    putCall: row.put_call,
    highYield: row.hy_oas ?? row.high_yield,
    bofa: row.bofa,
  }
  return snapshotHasRequiredHistoryMetrics(snap)
}

/**
 * PK(date) upsert: 같은 날짜만 갱신, 다른 날짜 행은 유지(다중 일자 공존).
 */
export async function upsertPanicIndexHistoryFromPayload(body, opts = {}) {
  const tradeDate = resolvePanicTradeDate(body, opts.tradeDate)
  const row = panicIndexHistoryRowFromPayload(body, tradeDate, opts)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row.date))) {
    return { ok: false, skipped: true, reason: "invalid_date", row }
  }
  if (!rowHasRequiredHistoryMetrics(row)) {
    return { ok: false, skipped: true, reason: "incomplete_core_metrics", row }
  }
  await postPanicIndexHistoryRow(row)
  return { ok: true, date: row.date }
}

function isSchemaColumnError(err) {
  const msg = err instanceof Error ? err.message : String(err || "")
  return /column|schema|does not exist|42703|PGRST204/i.test(msg)
}

/** @param {Record<string, unknown>} row */
async function postPanicIndexHistoryRow(row) {
  const core = {
    date: row.date,
    vix: row.vix,
    vxn: row.vxn,
    fear_greed: row.fear_greed,
    move: row.move,
    bofa: row.bofa,
    skew: row.skew,
    hy_oas: row.hy_oas,
    gs_sentiment: row.gs_sentiment,
    source: row.source ?? "manual",
    updated_at: row.updated_at,
    market: row.market ?? "global",
  }
  const { market: _market, high_yield: _hy, gs_bb: _gs, put_call: _pc, ...baseOnly } = row
  const attempts = [
    row,
    { ...core, put_call: row.put_call, high_yield: row.high_yield, gs_bb: row.gs_bb },
    { ...core, put_call: row.put_call },
    core,
    { ...baseOnly, source: baseOnly.source ?? "manual", updated_at: baseOnly.updated_at },
  ]
  let lastErr = null
  for (const body of attempts) {
    try {
      await supabaseRest("panic_index_history?on_conflict=date", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=representation",
        body,
      })
      return
    } catch (e) {
      lastErr = e
      if (!isSchemaColumnError(e)) throw e
    }
  }
  throw lastErr ?? new Error("panic_index_history_upsert_failed")
}

/**
 * @param {Array<Record<string, unknown> & { tradeDate?: string; date?: string }>} entries
 */
export async function upsertPanicIndexHistoryBatch(entries, opts = {}) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { ok: false, skipped: true, reason: "empty_batch" }
  }
  const rows = []
  for (const entry of entries) {
    const tradeDate = entry?.tradeDate || entry?.date
    const row = panicIndexHistoryRowFromPayload(entry, tradeDate, opts)
    if (rowHasRequiredHistoryMetrics(row)) rows.push(row)
  }
  if (!rows.length) {
    return { ok: false, skipped: true, reason: "incomplete_core_metrics" }
  }
  for (const row of rows) {
    await postPanicIndexHistoryRow(row)
  }
  return { ok: true, count: rows.length, dates: rows.map((r) => r.date) }
}

/**
 * @param {{ limit?: number, from?: string, to?: string }} [opts]
 */
export async function fetchPanicIndexHistoryRows(opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || 120, 1), 500)
  let q = `panic_index_history?select=*&order=date.desc&limit=${limit}`
  const from = opts.from ? String(opts.from).slice(0, 10) : ""
  const to = opts.to ? String(opts.to).slice(0, 10) : ""
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) q += `&date=gte.${from}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) q += `&date=lte.${to}`
  const rows = await supabaseRest(q, { method: "GET" })
  if (!Array.isArray(rows)) return []
  return rows
    .map(panicIndexHistoryRowToClient)
    .filter(Boolean)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
}
