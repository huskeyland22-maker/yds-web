/**
 * panic_history_v2 — Supabase 저장·조회·백필
 */
import { fetchPanicIndexHistoryRows } from "./panicIndexHistory.js"
import { mapPanicIndexHistoryRowToClient } from "./panicIndexHistoryColumns.js"
import { buildPanicV2DynamicSeries } from "./panicV2DynamicCompute.js"
import { supabaseRest } from "./supabaseRest.js"

export const PANIC_HISTORY_V2_SELECT =
  "date,panic_v2,vix,vxn,fear_greed,put_call,hy,move,skew,gs,bofa,source,updated_at"

function isSchemaColumnError(err) {
  const msg = err instanceof Error ? err.message : String(err || "")
  return /column|schema|does not exist|42703|PGRST204/i.test(msg)
}

function toNum(v) {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** panic_index_history / cycle row → cycle compute row */
export function cycleRowFromHistorySource(row) {
  if (!row || typeof row !== "object") return null
  const date = String(row.date ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const client = mapPanicIndexHistoryRowToClient(row) ?? row
  return {
    date,
    vix: toNum(client.vix ?? row.vix),
    vxn: toNum(client.vxn ?? row.vxn),
    fearGreed: toNum(client.fearGreed ?? row.fear_greed),
    putCall: toNum(client.putCall ?? row.put_call),
    highYield: toNum(client.highYield ?? client.hyOas ?? row.hy ?? row.hy_oas),
    move: toNum(client.move ?? row.move),
    skew: toNum(client.skew ?? row.skew),
    gsBullBear: toNum(client.gsBullBear ?? client.gsSentiment ?? row.gs ?? row.gs_sentiment),
    bofa: toNum(client.bofa ?? row.bofa),
    panicV2DynamicScore: toNum(row.panic_v2 ?? row.panicV2DynamicScore ?? row.panicV2Score),
    panicV2Score: toNum(row.panic_v2 ?? row.panicV2Score),
  }
}

/** cycle row → panic_history_v2 DB row */
export function panicHistoryV2DbRowFromCycle(cycleRow, panicV2, source = "yds") {
  const date = String(cycleRow?.date ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  return {
    date,
    panic_v2: panicV2 != null && Number.isFinite(panicV2) ? panicV2 : null,
    vix: toNum(cycleRow.vix),
    vxn: toNum(cycleRow.vxn),
    fear_greed: toNum(cycleRow.fearGreed),
    put_call: toNum(cycleRow.putCall),
    hy: toNum(cycleRow.highYield ?? cycleRow.hyOas ?? cycleRow.hy),
    move: toNum(cycleRow.move),
    skew: toNum(cycleRow.skew),
    gs: toNum(cycleRow.gsBullBear ?? cycleRow.gs),
    bofa: toNum(cycleRow.bofa),
    source,
    updated_at: new Date().toISOString(),
  }
}

/** DB row → 클라이언트 */
export function panicHistoryV2RowToClient(row) {
  if (!row || typeof row !== "object") return null
  const date = String(row.date ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const panicV2 = toNum(row.panic_v2)
  const statusId = row.status_id ?? null
  return {
    date,
    panicV2,
    panicV2Score: panicV2,
    panicV2DynamicScore: panicV2,
    panic_v2: panicV2,
    vix: toNum(row.vix),
    vxn: toNum(row.vxn),
    fearGreed: toNum(row.fear_greed),
    putCall: toNum(row.put_call),
    highYield: toNum(row.hy),
    hyOas: toNum(row.hy),
    hy: toNum(row.hy),
    move: toNum(row.move),
    skew: toNum(row.skew),
    gsBullBear: toNum(row.gs),
    gs: toNum(row.gs),
    bofa: toNum(row.bofa),
    panicV2StatusId: statusId,
    source: row.source ?? "yds",
    updatedAt: row.updated_at ?? null,
  }
}

/**
 * @param {{ limit?: number; from?: string; to?: string }} [opts]
 */
export async function fetchPanicHistoryV2Rows(opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || 500, 1), 2000)
  let q = `panic_history_v2?select=${PANIC_HISTORY_V2_SELECT}&order=date.desc&limit=${limit}`
  const from = opts.from ? String(opts.from).slice(0, 10) : ""
  const to = opts.to ? String(opts.to).slice(0, 10) : ""
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) q += `&date=gte.${from}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) q += `&date=lte.${to}`

  try {
    const rows = await supabaseRest(q, { method: "GET" })
    if (!Array.isArray(rows)) return []
    return rows
      .map(panicHistoryV2RowToClient)
      .filter(Boolean)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  } catch (err) {
    if (isSchemaColumnError(err)) {
      console.warn("[panic_history_v2] table missing or schema mismatch — run migration", err)
      return []
    }
    throw err
  }
}

/** @param {object[]} dbRows */
export async function upsertPanicHistoryV2Rows(dbRows) {
  if (!Array.isArray(dbRows) || !dbRows.length) {
    return { ok: false, skipped: true, reason: "empty_batch" }
  }
  const valid = dbRows.filter((r) => r?.date && /^\d{4}-\d{2}-\d{2}$/.test(String(r.date).slice(0, 10)))
  if (!valid.length) return { ok: false, skipped: true, reason: "no_valid_dates" }

  try {
    await supabaseRest("panic_history_v2?on_conflict=date", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: valid,
    })
    return { ok: true, count: valid.length, dates: valid.map((r) => r.date) }
  } catch (err) {
    if (isSchemaColumnError(err)) {
      console.warn("[panic_history_v2] upsert skipped — table missing", err)
      return { ok: false, skipped: true, reason: "table_missing", error: err instanceof Error ? err.message : String(err) }
    }
    throw err
  }
}

/**
 * panic_index_history → V2 동적 점수 계산 → panic_history_v2 upsert
 * @param {{ limit?: number; source?: string }} [opts]
 */
export async function backfillPanicHistoryV2FromIndexHistory(opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || 600, 8), 2000)
  const source = opts.source ?? "backfill"

  const indexRows = await fetchPanicIndexHistoryRows({ limit })
  if (!indexRows.length) {
    return { ok: false, skipped: true, reason: "panic_index_history_empty", count: 0 }
  }

  const cycleRows = indexRows.map((r) => cycleRowFromHistorySource(r)).filter(Boolean)
  if (cycleRows.length < 8) {
    return { ok: false, skipped: true, reason: "insufficient_history", count: cycleRows.length }
  }

  const series = buildPanicV2DynamicSeries(cycleRows)
  const scoreByDate = new Map(
    series.filter((p) => p.score != null).map((p) => [p.date, p.score]),
  )

  const dbRows = cycleRows
    .map((row) => {
      const score = scoreByDate.get(row.date) ?? null
      if (score == null) return null
      return panicHistoryV2DbRowFromCycle(row, score, source)
    })
    .filter(Boolean)

  const result = await upsertPanicHistoryV2Rows(dbRows)
  return {
    ...result,
    indexRows: indexRows.length,
    scored: dbRows.length,
    seriesPoints: series.filter((p) => p.score != null).length,
  }
}

/**
 * 저장 직후 오늘(또는 tradeDate) V2 1건 upsert
 * @param {ReturnType<typeof import('./panicSnapshot.js').normalizePanicPayload>} snap
 */
export async function upsertPanicHistoryV2ForSnapshot(snap, opts = {}) {
  const tradeDate = String(snap?.tradeDate ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tradeDate)) {
    return { ok: false, skipped: true, reason: "invalid_date" }
  }

  const historyLimit = Math.min(Math.max(Number(opts.historyLimit) || 600, 8), 2000)
  const indexRows = await fetchPanicIndexHistoryRows({ limit: historyLimit })
  const cycleRows = indexRows.map((r) => cycleRowFromHistorySource(r)).filter(Boolean)

  const todayRow = cycleRowFromHistorySource({
    date: tradeDate,
    vix: snap.vix,
    vxn: snap.vxn,
    fear_greed: snap.fearGreed,
    put_call: snap.putCall,
    hy_oas: snap.highYield,
    move: snap.move,
    skew: snap.skew,
    gs_sentiment: snap.gsBullBear,
    bofa: snap.bofa,
  })

  if (!todayRow) return { ok: false, skipped: true, reason: "invalid_snapshot" }

  const byDate = new Map(cycleRows.map((r) => [r.date, r]))
  byDate.set(tradeDate, { ...byDate.get(tradeDate), ...todayRow, date: tradeDate })
  const merged = [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)))

  if (merged.length < 8) {
    console.warn("[panic_history_v2] skip save — need 8+ days for dynamic score", merged.length)
    return { ok: false, skipped: true, reason: "insufficient_history", count: merged.length }
  }

  const series = buildPanicV2DynamicSeries(merged)
  const hit = series.find((p) => p.date === tradeDate && p.score != null)
  const score = hit?.score ?? null
  if (score == null) {
    return { ok: false, skipped: true, reason: "score_not_computed", date: tradeDate }
  }

  const dbRow = panicHistoryV2DbRowFromCycle(todayRow, score, opts.source ?? snap.source ?? "save")
  const result = await upsertPanicHistoryV2Rows([dbRow])
  return { ...result, date: tradeDate, panic_v2: score }
}
