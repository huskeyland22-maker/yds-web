import { supabaseRest } from "./supabaseRest.js"
import { enrichPanicHistoryRow } from "./marketCycleCompute.js"
import { assertPanicHistoryRowNumeric, finalizePanicHistoryRow } from "./panicNumeric.js"
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
    panicScore: pick("panic_score"),
    marketPhase: row.market_phase ?? null,
    riskLevel: row.risk_level ?? null,
    strategy: row.strategy ?? null,
    createdAt: row.created_at ?? row.updated_at ?? null,
  }
}

/** @param {string} tradeDate YYYY-MM-DD */
export async function fetchPanicHistoryRowBefore(tradeDate) {
  const d = String(tradeDate).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null
  try {
    const rows = await supabaseRest(
      `panic_index_history?select=*&date=lt.${d}&order=date.desc&limit=1`,
      { method: "GET" },
    )
    return Array.isArray(rows) && rows[0] ? rows[0] : null
  } catch {
    return null
  }
}

function isRpcMissing(err) {
  const msg = err instanceof Error ? err.message : String(err || "")
  return /function|rpc|does not exist|42883|PGRST202/i.test(msg)
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
  const snap = normalizePanicPayload(body, { tradeDate, source: opts.source })
  const row = panicIndexHistoryRowFromSnapshot(snap)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row.date))) {
    return { ok: false, skipped: true, reason: "invalid_date", row }
  }
  if (!rowHasRequiredHistoryMetrics(row)) {
    return { ok: false, skipped: true, reason: "incomplete_core_metrics", row }
  }
  const previous = await fetchPanicHistoryRowBefore(row.date)
  await postPanicIndexHistoryRow(row, snap, previous)
  return { ok: true, date: row.date }
}

function isSchemaColumnError(err) {
  const msg = err instanceof Error ? err.message : String(err || "")
  return /column|schema|does not exist|42703|PGRST204/i.test(msg)
}

/** @param {Record<string, unknown>} row */
async function postPanicIndexHistoryRow(row, snap, previousHistoryRow) {
  let normalized = finalizePanicHistoryRow(row)
  if (snap) {
    normalized = enrichPanicHistoryRow(normalized, snap, previousHistoryRow)
  }
  assertPanicHistoryRowNumeric(normalized)

  const payload = {
    date: normalized.date,
    vix: normalized.vix,
    vxn: normalized.vxn,
    fear_greed: normalized.fear_greed,
    put_call: normalized.put_call,
    move: normalized.move,
    bofa: normalized.bofa,
    skew: normalized.skew,
    hy_oas: normalized.hy_oas,
    gs_sentiment: normalized.gs_sentiment,
    high_yield: normalized.high_yield,
    gs_bb: normalized.gs_bb,
    market: normalized.market ?? "global",
    source: normalized.source ?? "manual",
    panic_score: normalized.panic_score,
    market_phase: normalized.market_phase,
    risk_level: normalized.risk_level,
    strategy: normalized.strategy,
    created_at: normalized.created_at,
    updated_at: normalized.updated_at,
  }

  try {
    await supabaseRest("rpc/upsert_panic_index_history_fill", {
      method: "POST",
      prefer: "return=representation",
      body: { p_payload: payload },
    })
    return
  } catch (rpcErr) {
    if (!isRpcMissing(rpcErr)) throw rpcErr
    console.warn("[panic_index_history] RPC missing — legacy merge upsert fallback")
  }

  const core = {
    date: normalized.date,
    vix: normalized.vix,
    vxn: normalized.vxn,
    fear_greed: normalized.fear_greed,
    move: normalized.move,
    bofa: normalized.bofa,
    skew: normalized.skew,
    hy_oas: normalized.hy_oas,
    gs_sentiment: normalized.gs_sentiment,
    source: normalized.source ?? "manual",
    updated_at: normalized.updated_at,
    market: normalized.market ?? "global",
  }
  const attempts = [
    { ...normalized, ...payload },
    { ...core, put_call: normalized.put_call, high_yield: normalized.high_yield, gs_bb: normalized.gs_bb },
    { ...core, put_call: normalized.put_call },
    core,
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
    const snap = normalizePanicPayload(entry, { tradeDate, source: opts.source })
    const row = panicIndexHistoryRowFromSnapshot(snap)
    if (rowHasRequiredHistoryMetrics(row)) rows.push({ row, snap })
  }
  if (!rows.length) {
    return { ok: false, skipped: true, reason: "incomplete_core_metrics" }
  }
  rows.sort((a, b) => String(a.row.date).localeCompare(String(b.row.date)))
  let previous = null
  for (const { row, snap } of rows) {
    if (!previous || String(previous.date) >= String(row.date)) {
      previous = await fetchPanicHistoryRowBefore(row.date)
    }
    await postPanicIndexHistoryRow(row, snap, previous)
    previous = { ...row, ...snap }
  }
  return { ok: true, count: rows.length, dates: rows.map((r) => r.row.date) }
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
