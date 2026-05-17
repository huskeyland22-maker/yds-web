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
  const hy = toNum(body?.highYield ?? body?.hyOas ?? body?.high_yield)
  const gs = toNum(body?.gsBullBear ?? body?.gsSentiment ?? body?.gs ?? body?.gs_bb)
  return {
    date,
    vix: toNum(body?.vix),
    fear_greed: toNum(body?.fearGreed ?? body?.fear_greed),
    put_call: toNum(body?.putCall ?? body?.put_call),
    high_yield: hy,
    hy_oas: hy,
    bofa: toNum(body?.bofa),
    move: toNum(body?.move),
    skew: toNum(body?.skew),
    gs_bb: gs,
    gs_sentiment: gs,
    vxn: toNum(body?.vxn),
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
    hyOas: pick("hy_oas") ?? pick("high_yield"),
    highYield: pick("high_yield") ?? pick("hy_oas"),
    putCall: pick("put_call"),
    gsSentiment: pick("gs_sentiment") ?? pick("gs_bb"),
    gsBullBear: pick("gs_bb") ?? pick("gs_sentiment"),
    createdAt: row.created_at ?? row.updated_at ?? null,
  }
}

function resolveTradeDate(body, tradeDateOverride) {
  const raw = tradeDateOverride || body?.tradeDate || body?.historyDate
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.slice(0, 10))) return raw.slice(0, 10)
  return calendarDateFromPayload(body)
}

/** AI 수동 입력 최소 필드 (App REQUIRED_KEYS와 동일) */
function rowHasRequiredHistoryMetrics(row) {
  const hy = row.high_yield ?? row.hy_oas
  return (
    row.vix != null &&
    row.fear_greed != null &&
    row.put_call != null &&
    hy != null &&
    row.bofa != null
  )
}

/**
 * PK(date) upsert: 같은 날짜만 갱신, 다른 날짜 행은 유지(다중 일자 공존).
 */
export async function upsertPanicIndexHistoryFromPayload(body, opts = {}) {
  const tradeDate = resolveTradeDate(body, opts.tradeDate)
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

/** @param {Record<string, unknown>} row */
async function postPanicIndexHistoryRow(row) {
  try {
    await supabaseRest("panic_index_history?on_conflict=date", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: row,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!/high_yield|gs_bb|column/i.test(msg)) throw e
    const { high_yield: _hy, gs_bb: _gs, ...legacy } = row
    await supabaseRest("panic_index_history?on_conflict=date", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: legacy,
    })
  }
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
