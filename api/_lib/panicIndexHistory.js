import { supabaseRest } from "./supabaseRest.js"

function toNum(v) {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

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
  const date = tradeDate || calendarDateFromPayload(body)
  const nowIso = new Date().toISOString()
  const source = typeof opts.source === "string" && opts.source ? opts.source : "api"
  return {
    date,
    vix: toNum(body?.vix),
    vxn: toNum(body?.vxn),
    fear_greed: toNum(body?.fearGreed),
    move: toNum(body?.move),
    bofa: toNum(body?.bofa),
    skew: toNum(body?.skew),
    put_call: toNum(body?.putCall),
    hy_oas: toNum(body?.highYield ?? body?.hyOas),
    gs_sentiment: toNum(body?.gsBullBear ?? body?.gsSentiment ?? body?.gs),
    source,
    updated_at: nowIso,
  }
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
    hyOas: pick("hy_oas"),
    putCall: pick("put_call"),
    gsSentiment: pick("gs_sentiment"),
    createdAt: row.created_at ?? row.updated_at ?? null,
  }
}

function resolveTradeDate(body, tradeDateOverride) {
  const raw = tradeDateOverride || body?.tradeDate || body?.historyDate
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.slice(0, 10))) return raw.slice(0, 10)
  return calendarDateFromPayload(body)
}

function rowHasCoreMetrics(row) {
  const core = ["vix", "fear_greed", "put_call", "hy_oas", "bofa"]
  return core.every((k) => row[k] != null)
}

/**
 * PK(date) upsert: 같은 날짜만 갱신, 다른 날짜 행은 유지(다중 일자 공존).
 */
export async function upsertPanicIndexHistoryFromPayload(body, opts = {}) {
  const tradeDate = resolveTradeDate(body, opts.tradeDate)
  const row = panicIndexHistoryRowFromPayload(body, tradeDate, opts)
  if (!rowHasCoreMetrics(row)) {
    return { ok: false, skipped: true, reason: "incomplete_core_metrics" }
  }
  await supabaseRest("panic_index_history?on_conflict=date", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: row,
  })
  return { ok: true, date: row.date }
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
    if (rowHasCoreMetrics(row)) rows.push(row)
  }
  if (!rows.length) {
    return { ok: false, skipped: true, reason: "incomplete_core_metrics" }
  }
  await supabaseRest("panic_index_history?on_conflict=date", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: rows,
  })
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
