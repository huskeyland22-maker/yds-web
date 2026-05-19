import { supabaseRest } from "./supabaseRest.js"
import { panicObjectFromSnapshot } from "./panicSnapshot.js"
import { getFinalScore } from "./panicScores.js"

/** @param {ReturnType<typeof import('./panicSnapshot.js').normalizePanicPayload>} snap */
export function latestPanicMetricsRowFromSnapshot(snap) {
  return {
    id: "global",
    date: snap.tradeDate,
    vix: snap.vix,
    vxn: snap.vxn,
    fear_greed: snap.fearGreed,
    put_call: snap.putCall,
    move: snap.move,
    bofa: snap.bofa,
    skew: snap.skew,
    hy_oas: snap.highYield,
    gs_sentiment: snap.gsBullBear,
    panic_score: getFinalScore({
      vix: snap.vix,
      fearGreed: snap.fearGreed,
      putCall: snap.putCall,
      bofa: snap.bofa,
      highYield: snap.highYield,
    }),
    updated_at: snap.updatedAt,
  }
}

export async function syncLatestPanicMetricsRpc(tradeDate) {
  const body = tradeDate ? { p_date: tradeDate } : {}
  return supabaseRest("rpc/sync_latest_panic_metrics", {
    method: "POST",
    prefer: "return=representation",
    body,
  })
}

export async function fetchLatestPanicMetricsRow() {
  const rows = await supabaseRest("latest_panic_metrics?select=*&id=eq.global&limit=1", {
    method: "GET",
  })
  if (Array.isArray(rows) && rows[0]) return rows[0]
  return null
}

export function panicObjectFromLatestRow(row) {
  if (!row) return null
  const snap = {
    tradeDate: String(row.date ?? "").slice(0, 10),
    updatedAt: row.updated_at ?? new Date().toISOString(),
    source: "db",
    vix: row.vix,
    vxn: row.vxn,
    fearGreed: row.fear_greed,
    putCall: row.put_call,
    bofa: row.bofa,
    move: row.move,
    skew: row.skew,
    highYield: row.hy_oas,
    gsBullBear: row.gs_sentiment,
  }
  const data = panicObjectFromSnapshot(snap)
  if (row.panic_score != null) data.panicIndex = Number(row.panic_score)
  return data
}
