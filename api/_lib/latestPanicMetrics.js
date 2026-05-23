import {
  fetchPanicIndexHistoryRaw,
  mapPanicIndexHistoryRowToClient,
  PANIC_INDEX_HISTORY_SELECT,
  pickGsFromRow,
  pickHyFromRow,
} from "./panicIndexHistoryColumns.js"
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

/** metaRisk·reason·slope 등 신규/실험 컬럼 제외 */
export const LATEST_PANIC_METRICS_CORE_SELECT =
  "id,date,vix,vxn,put_call,fear_greed,move,bofa,skew,hy_oas,gs_sentiment,panic_score,updated_at"

/** panic_index_history (panic_history) 핵심 컬럼만 — alias 컬럼 제외 */
export const PANIC_INDEX_HISTORY_CORE_SELECT = PANIC_INDEX_HISTORY_SELECT

export async function fetchLatestPanicMetricsRow() {
  const result = await supabaseRest(
    `latest_panic_metrics?select=${LATEST_PANIC_METRICS_CORE_SELECT}&id=eq.global&limit=1`,
    { method: "GET" },
  )
  console.log("panic latest result", result)
  if (!result || !Array.isArray(result) || !result[0]) return null
  return result[0]
}

/** @returns {Record<string, unknown> | null} panic_index_history 최신 1건 */
export async function fetchLatestPanicIndexHistoryCore() {
  const result = await fetchPanicIndexHistoryRaw(supabaseRest, "order=date.desc&limit=1")
  if (!result.length) return null
  return result[0]
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
    highYield: pickHyFromRow(row),
    gsBullBear: pickGsFromRow(row),
  }
  const data = panicObjectFromSnapshot(snap)
  if (row.panic_score != null) data.panicIndex = Number(row.panic_score)
  return data
}

/** panic_index_history row → 클라이언트 panic 객체 */
export function panicObjectFromHistoryCoreRow(row) {
  return panicObjectFromLatestRow(row)
}

export { mapPanicIndexHistoryRowToClient }
