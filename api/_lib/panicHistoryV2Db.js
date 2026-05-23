/**
 * panic_index_history_v2 — Supabase 저장·조회·백필 (레벨 가중치)
 */
import { fetchPanicIndexHistoryRows } from "./panicIndexHistory.js"
import { mapPanicIndexHistoryRowToClient } from "./panicIndexHistoryColumns.js"
import { computePanicV2LevelScore } from "./panicV2LevelScore.js"
import { resolvePanicV2Status } from "./panicV2Status.js"
import { supabaseRest } from "./supabaseRest.js"

export const PANIC_INDEX_HISTORY_V2_TABLE = "panic_index_history_v2"
export const PANIC_INDEX_HISTORY_V2_SELECT =
  "date,vix,vxn,fear_greed,put_call,high_yield,move,skew,gs,bofa,panic_index_v2,source,updated_at"

/** DB에 데이터 있는 테이블 (panic_history_v2) 우선 */
const LEGACY_TABLE = "panic_history_v2"
const LEGACY_SELECT_MINIMAL = "date,panic_v2,vix,hy"
const LEGACY_SELECT = "date,panic_v2,vix,vxn,fear_greed,put_call,hy,move,skew,gs,bofa,source,updated_at"

const V2_FETCH_ATTEMPTS = [
  { table: LEGACY_TABLE, select: LEGACY_SELECT_MINIMAL },
  { table: LEGACY_TABLE, select: LEGACY_SELECT },
  { table: PANIC_INDEX_HISTORY_V2_TABLE, select: PANIC_INDEX_HISTORY_V2_SELECT },
]

function isSchemaColumnError(err) {
  const msg = err instanceof Error ? err.message : String(err || "")
  return /column|schema|does not exist|42703|PGRST204|relation/i.test(msg)
}

function toNum(v) {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** @param {string} table @param {string} select @param {string} suffix */
async function restGetV2(table, select, suffix) {
  return supabaseRest(`${table}?select=${select}&${suffix}`, { method: "GET" })
}

/** @param {string} table @param {object[]} rows */
async function restUpsertV2(table, rows) {
  return supabaseRest(`${table}?on_conflict=date`, {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: rows,
  })
}

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
    highYield: toNum(client.highYield ?? client.hyOas ?? row.high_yield ?? row.hy ?? row.hy_oas),
    move: toNum(client.move ?? row.move),
    skew: toNum(client.skew ?? row.skew),
    gsBullBear: toNum(client.gsBullBear ?? client.gsSentiment ?? row.gs ?? row.gs_sentiment),
    bofa: toNum(client.bofa ?? row.bofa),
  }
}

/** @param {object} cycleRow @param {number | null} panicIndexV2 @param {string} [source] */
export function panicIndexHistoryV2DbRow(cycleRow, panicIndexV2, source = "yds") {
  const date = String(cycleRow?.date ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const hy = toNum(cycleRow.highYield ?? cycleRow.hyOas ?? cycleRow.hy)
  return {
    date,
    vix: toNum(cycleRow.vix),
    vxn: toNum(cycleRow.vxn),
    fear_greed: toNum(cycleRow.fearGreed),
    put_call: toNum(cycleRow.putCall),
    high_yield: hy,
    move: toNum(cycleRow.move),
    skew: toNum(cycleRow.skew),
    gs: toNum(cycleRow.gsBullBear ?? cycleRow.gs),
    bofa: toNum(cycleRow.bofa),
    panic_index_v2:
      panicIndexV2 != null && Number.isFinite(panicIndexV2) ? panicIndexV2 : null,
    source,
    updated_at: new Date().toISOString(),
  }
}

/** @deprecated alias */
export function panicHistoryV2DbRowFromCycle(cycleRow, score, source) {
  return panicIndexHistoryV2DbRow(cycleRow, score, source)
}

export function panicHistoryV2RowToClient(row) {
  if (!row || typeof row !== "object") return null
  const date = String(row.date ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const panicV2 = toNum(row.panic_index_v2 ?? row.panic_v2)
  const hy = toNum(row.high_yield ?? row.hy)
  const status = resolvePanicV2Status(panicV2)
  return {
    date,
    panicV2,
    panicV2Score: panicV2,
    panicV2DynamicScore: panicV2,
    panic_index_v2: panicV2,
    panic_v2: panicV2,
    vix: toNum(row.vix),
    vxn: toNum(row.vxn),
    fearGreed: toNum(row.fear_greed),
    putCall: toNum(row.put_call),
    highYield: hy,
    hyOas: hy,
    hy,
    move: toNum(row.move),
    skew: toNum(row.skew),
    gsBullBear: toNum(row.gs),
    gs: toNum(row.gs),
    bofa: toNum(row.bofa),
    panicV2Status: status?.label ?? null,
    panicV2StatusId: status?.id ?? null,
    source: row.source ?? "yds",
    updatedAt: row.updated_at ?? null,
  }
}

/**
 * @param {object[]} clientRows
 */
export function logPanicV2BackfillSummary(clientRows, label = "패닉V2") {
  const sorted = [...(clientRows || [])]
    .filter((r) => r?.date && toNum(r.panicV2 ?? r.panic_index_v2) != null)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const recent30 = sorted.slice(-30)
  const latest = recent30[recent30.length - 1] ?? null
  const currentScore = toNum(latest?.panicV2 ?? latest?.panic_index_v2)
  const status = resolvePanicV2Status(currentScore)
  const summary = {
    label,
    recent30Days: recent30.length,
    currentScore,
    status: status?.label ?? "—",
    latestDate: latest?.date ?? null,
  }
  console.log("[패닉V2 백필 완료]", summary)
  return summary
}

/**
 * @param {{ limit?: number; from?: string; to?: string }} [opts]
 */
export async function fetchPanicHistoryV2Rows(opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || 30, 1), 2000)
  let suffix = `order=date.desc&limit=${limit}`
  const from = opts.from ? String(opts.from).slice(0, 10) : ""
  const to = opts.to ? String(opts.to).slice(0, 10) : ""
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) suffix += `&date=gte.${from}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) suffix += `&date=lte.${to}`

  for (const { table, select } of V2_FETCH_ATTEMPTS) {
    try {
      const rows = await restGetV2(table, select, suffix)
      if (!Array.isArray(rows)) return []
      const mapped = rows.map(panicHistoryV2RowToClient).filter(Boolean)
      if (mapped.length) {
        return mapped.sort((a, b) => String(a.date).localeCompare(String(b.date)))
      }
    } catch (err) {
      if (isSchemaColumnError(err)) {
        console.warn(`[${table}] fetch fallback`, err instanceof Error ? err.message : err)
        continue
      }
      throw err
    }
  }
  return []
}

/** @param {object[]} dbRows */
export async function upsertPanicHistoryV2Rows(dbRows) {
  if (!Array.isArray(dbRows) || !dbRows.length) {
    return { ok: false, skipped: true, reason: "empty_batch" }
  }
  const valid = dbRows.filter((r) => r?.date && /^\d{4}-\d{2}-\d{2}$/.test(String(r.date).slice(0, 10)))
  if (!valid.length) return { ok: false, skipped: true, reason: "no_valid_dates" }

  let lastErr = null
  for (const { table } of V2_FETCH_ATTEMPTS) {
    try {
      const payload =
        table === PANIC_INDEX_HISTORY_V2_TABLE
          ? valid
          : valid.map((r) => ({
              date: r.date,
              panic_v2: r.panic_index_v2 ?? r.panic_v2,
              vix: r.vix,
              vxn: r.vxn,
              fear_greed: r.fear_greed,
              put_call: r.put_call,
              hy: r.high_yield ?? r.hy,
              move: r.move,
              skew: r.skew,
              gs: r.gs,
              bofa: r.bofa,
              source: r.source,
              updated_at: r.updated_at,
            }))
      await restUpsertV2(table, payload)
      return { ok: true, count: valid.length, dates: valid.map((r) => r.date), table }
    } catch (err) {
      lastErr = err
      if (isSchemaColumnError(err)) {
        console.warn(`[${table}] upsert skipped`, err instanceof Error ? err.message : err)
        continue
      }
      throw err
    }
  }
  return {
    ok: false,
    skipped: true,
    reason: "table_missing",
    error: lastErr instanceof Error ? lastErr.message : String(lastErr),
  }
}

/**
 * panic_index_history → 최근 N일 레벨 V2 백필
 * @param {{ days?: number; limit?: number; source?: string }} [opts]
 */
export async function backfillPanicHistoryV2FromIndexHistory(opts = {}) {
  const days = Math.min(Math.max(Number(opts.days) || 30, 1), 90)
  const limit = Math.min(Math.max(Number(opts.limit) || days + 5, days), 2000)
  const source = opts.source ?? "backfill_30d"

  const indexRows = await fetchPanicIndexHistoryRows({ limit })
  if (!indexRows.length) {
    return { ok: false, skipped: true, reason: "panic_index_history_empty", count: 0 }
  }

  const cycleRows = indexRows.map((r) => cycleRowFromHistorySource(r)).filter(Boolean)
  const sorted = cycleRows.sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const lastN = sorted.slice(-days)

  const dbRows = []
  const clientPreview = []

  for (const row of lastN) {
    const { score } = computePanicV2LevelScore(row)
    if (score == null) continue
    const dbRow = panicIndexHistoryV2DbRow(row, score, source)
    if (!dbRow) continue
    dbRows.push(dbRow)
    clientPreview.push(panicHistoryV2RowToClient(dbRow))
  }

  if (!dbRows.length) {
    return {
      ok: false,
      skipped: true,
      reason: "no_scored_rows",
      indexRows: indexRows.length,
      daysRequested: days,
    }
  }

  const result = await upsertPanicHistoryV2Rows(dbRows)
  const summary = logPanicV2BackfillSummary(clientPreview)

  return {
    ...result,
    indexRows: indexRows.length,
    scored: dbRows.length,
    daysRequested: days,
    summary,
  }
}

/**
 * @param {ReturnType<typeof import('./panicSnapshot.js').normalizePanicPayload>} snap
 */
export async function upsertPanicHistoryV2ForSnapshot(snap, opts = {}) {
  const tradeDate = String(snap?.tradeDate ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tradeDate)) {
    return { ok: false, skipped: true, reason: "invalid_date" }
  }

  const todayRow = cycleRowFromHistorySource({
    date: tradeDate,
    vix: snap.vix,
    vxn: snap.vxn,
    fear_greed: snap.fearGreed,
    put_call: snap.putCall,
    high_yield: snap.highYield,
    hy_oas: snap.highYield,
    move: snap.move,
    skew: snap.skew,
    gs_sentiment: snap.gsBullBear,
    bofa: snap.bofa,
  })

  if (!todayRow) return { ok: false, skipped: true, reason: "invalid_snapshot" }

  const { score, status } = computePanicV2LevelScore(todayRow)
  if (score == null) {
    return { ok: false, skipped: true, reason: "score_not_computed", date: tradeDate }
  }

  const dbRow = panicIndexHistoryV2DbRow(todayRow, score, opts.source ?? snap.source ?? "save")
  const result = await upsertPanicHistoryV2Rows([dbRow])
  logPanicV2BackfillSummary([panicHistoryV2RowToClient(dbRow)])
  return {
    ...result,
    date: tradeDate,
    panic_index_v2: score,
    panic_v2: score,
    status: status?.label ?? null,
  }
}
