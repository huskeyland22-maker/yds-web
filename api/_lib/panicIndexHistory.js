import { enrichPanicIndexHistoryWithV2 } from "./panicHistoryEnrichV2.js"
import { supabaseRest } from "./supabaseRest.js"
import { enrichPanicHistoryRow } from "./marketCycleCompute.js"
import {
  fetchPanicIndexHistoryRaw,
  isSchemaColumnError,
  mapPanicIndexHistoryRowToClient,
  panicIndexHistoryDbPayloadFromNormalized,
  pickHyFromRow,
} from "./panicIndexHistoryColumns.js"
import { assertPanicHistoryRowNumeric, finalizePanicHistoryRow } from "./panicNumeric.js"
import {
  normalizePanicPayload,
  panicIndexHistoryRowFromSnapshot,
  resolvePanicTradeDate,
} from "./panicSnapshot.js"
import { validateCorePanicMetrics } from "./panicSaveValidate.js"

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
  return mapPanicIndexHistoryRowToClient(row)
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

/** Same-date existing row — BofA/HY weekly 보존용 */
export async function fetchPanicHistoryRowByDate(tradeDate) {
  const d = String(tradeDate).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null
  try {
    const rows = await supabaseRest(
      `panic_index_history?select=*&date=eq.${d}&limit=1`,
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

/**
 * 동일 date 기존 BofA/HY를 null로 덮지 않음 (weekly/지속형)
 * @param {Record<string, unknown>} row
 * @param {Record<string, unknown> | null} existingSameDate
 */
export function preserveWeeklyCoreFields(row, existingSameDate) {
  if (!row || typeof row !== "object") return row
  const out = { ...row }
  if (!existingSameDate || typeof existingSameDate !== "object") return out
  if (out.bofa == null && existingSameDate.bofa != null) {
    out.bofa = existingSameDate.bofa
  }
  const existingHy = pickHyFromRow(existingSameDate)
  if (out.hy_oas == null && existingHy != null) {
    out.hy_oas = existingHy
  }
  return out
}

/**
 * PK(date) upsert: 같은 날짜만 갱신, 다른 날짜 행은 유지(다중 일자 공존).
 * 핵심 5지표 미완이면 upsert를 실행하지 않음.
 */
export async function upsertPanicIndexHistoryFromPayload(body, opts = {}) {
  const tradeDate = resolvePanicTradeDate(body, opts.tradeDate)
  const snap = normalizePanicPayload(body, { tradeDate, source: opts.source })
  let row = panicIndexHistoryRowFromSnapshot(snap)
  console.log("[YDS][upsertHistory] start", { tradeDate: row?.date ?? tradeDate ?? null })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row.date))) {
    return { ok: false, skipped: true, reason: "invalid_date", row }
  }

  const existingSameDate = await fetchPanicHistoryRowByDate(row.date)
  row = preserveWeeklyCoreFields(row, existingSameDate)

  const coreCheck = validateCorePanicMetrics({
    tradeDate: row.date,
    vix: row.vix,
    fearGreed: row.fear_greed,
    putCall: row.put_call,
    bofa: row.bofa,
    highYield: row.hy_oas,
  })
  if (!coreCheck.ok) {
    return {
      ok: false,
      skipped: true,
      reason: "incomplete_core_metrics",
      code: "INCOMPLETE_CORE_METRICS",
      missing: coreCheck.missing,
      message: coreCheck.message,
      row,
    }
  }

  const previous = await fetchPanicHistoryRowBefore(row.date)
  await postPanicIndexHistoryRow(row, snap, previous)
  console.log("[YDS][upsertHistory] ok", { tradeDate: row.date })
  return { ok: true, date: row.date }
}

/** @param {Record<string, unknown>} row */
async function postPanicIndexHistoryRow(row, snap, previousHistoryRow) {
  let normalized = finalizePanicHistoryRow(row)
  if (snap) {
    normalized = enrichPanicHistoryRow(normalized, snap, previousHistoryRow)
  }
  assertPanicHistoryRowNumeric(normalized)

  const payload = panicIndexHistoryDbPayloadFromNormalized(normalized)

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
    date: payload.date,
    vix: payload.vix,
    vxn: payload.vxn,
    fear_greed: payload.fear_greed,
    move: payload.move,
    bofa: payload.bofa,
    skew: payload.skew,
    hy_oas: payload.hy_oas,
    gs_sentiment: payload.gs_sentiment,
    source: payload.source ?? "manual",
    updated_at: payload.updated_at,
    market: payload.market ?? "global",
  }
  const attempts = [
    payload,
    { ...core, put_call: payload.put_call, panic_score: payload.panic_score },
    { ...core, put_call: payload.put_call },
    core,
  ]
  let lastErr = null
  for (const body of attempts) {
    try {
      // PK(date) — insert 금지, 동일 date는 upsert만
      await supabaseRest("panic_index_history?on_conflict=date", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=representation",
        body: [body],
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
    let row = panicIndexHistoryRowFromSnapshot(snap)
    const existingSameDate = await fetchPanicHistoryRowByDate(row.date)
    row = preserveWeeklyCoreFields(row, existingSameDate)
    const coreCheck = validateCorePanicMetrics({
      tradeDate: row.date,
      vix: row.vix,
      fearGreed: row.fear_greed,
      putCall: row.put_call,
      bofa: row.bofa,
      highYield: row.hy_oas,
    })
    if (coreCheck.ok) rows.push({ row, snap })
  }
  if (!rows.length) {
    return {
      ok: false,
      skipped: true,
      reason: "incomplete_core_metrics",
      code: "INCOMPLETE_CORE_METRICS",
      message: "핵심 Panic Index 5개가 모두 입력되어야 저장할 수 있습니다.",
    }
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
  let suffix = `order=date.desc&limit=${limit}`
  const from = opts.from ? String(opts.from).slice(0, 10) : ""
  const to = opts.to ? String(opts.to).slice(0, 10) : ""
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) suffix += `&date=gte.${from}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) suffix += `&date=lte.${to}`
  const rows = await fetchPanicIndexHistoryRaw(supabaseRest, suffix)
  const clientRows = rows
    .map(panicIndexHistoryRowToClient)
    .filter(Boolean)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  return enrichPanicIndexHistoryWithV2(clientRows)
}
