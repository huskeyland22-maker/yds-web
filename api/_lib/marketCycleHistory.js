import { supabaseRest } from "./supabaseRest.js"
import { buildMarketCyclePayload } from "./marketCycleCompute.js"

function isRpcMissing(err) {
  const msg = err instanceof Error ? err.message : String(err || "")
  return /function|rpc|does not exist|42883|PGRST202/i.test(msg)
}

export async function upsertMarketCycleHistoryFromSnapshot(snap, previousHistoryRow, opts = {}) {
  const payload = buildMarketCyclePayload(snap, previousHistoryRow, opts.source ?? snap.source ?? "api")
  try {
    await supabaseRest("rpc/upsert_market_cycle_history_fill", {
      method: "POST",
      prefer: "return=minimal",
      body: { p_payload: payload },
    })
    return { ok: true, date: payload.date }
  } catch (err) {
    if (!isRpcMissing(err)) throw err
    console.warn("[market_cycle_history] RPC missing — skip", err instanceof Error ? err.message : err)
    return { ok: false, skipped: true, reason: "rpc_missing" }
  }
}

/**
 * @param {{ limit?: number, from?: string, to?: string }} [opts]
 */
export async function fetchMarketCycleHistoryRows(opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || 120, 1), 500)
  let q = `market_cycle_history?select=*&order=date.desc&limit=${limit}`
  const from = opts.from ? String(opts.from).slice(0, 10) : ""
  const to = opts.to ? String(opts.to).slice(0, 10) : ""
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) q += `&date=gte.${from}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) q += `&date=lte.${to}`
  try {
    const rows = await supabaseRest(q, { method: "GET" })
    if (!Array.isArray(rows)) return []
    return rows.sort((a, b) => String(a.date).localeCompare(String(b.date)))
  } catch (err) {
    if (isRpcMissing(err) || /relation|does not exist/i.test(String(err?.message || err))) return []
    throw err
  }
}

export async function fetchMarketCycleRowByDate(tradeDate) {
  const d = String(tradeDate ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null
  try {
    const rows = await supabaseRest(`market_cycle_history?select=*&date=eq.${d}&limit=1`, {
      method: "GET",
    })
    return Array.isArray(rows) && rows[0] ? rows[0] : null
  } catch {
    return null
  }
}

export function marketCycleRowToClient(row) {
  if (!row || typeof row !== "object") return null
  const dateStr = String(row.date ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null
  return {
    date: dateStr,
    ts: `${dateStr}T12:00:00.000Z`,
    panicScore: row.panic_score != null ? Number(row.panic_score) : null,
    marketState: row.market_state ?? null,
    riskSignal: row.risk_signal ?? null,
    sector: row.sector ?? null,
    volatility: row.volatility ?? null,
    shortScore: row.short_score != null ? Number(row.short_score) : null,
    midScore: row.mid_score != null ? Number(row.mid_score) : null,
    longScore: row.long_score != null ? Number(row.long_score) : null,
    recommendation: row.recommendation ?? null,
  }
}
