/**
 * /api/panic?mode=… — mode별 핸들러 (Vercel 단일 함수)
 */
import { isSupabaseConfigured } from "./supabaseRest.js"
import { panicEmergencyHubData, PANIC_EMERGENCY_ROWS } from "./panicEmergencyFallback.js"
import {
  fetchLatestPanicIndexHistoryCore,
  fetchLatestPanicMetricsRow,
  panicObjectFromHistoryCoreRow,
  panicObjectFromLatestRow,
} from "./latestPanicMetrics.js"
import {
  fetchPanicMetricsRows,
  panicObjectFromRows,
  probePanicMetricsNumericInsert,
} from "./panicMetricsHub.js"
import { computePanicServeMeta } from "./panicServeMeta.js"
import { fetchPanicIndexHistoryRows } from "./panicIndexHistory.js"
import {
  fetchMarketCycleHistoryRows,
  marketCycleRowToClient,
} from "./marketCycleHistory.js"
import { fetchPanicHistoryV2Rows, backfillPanicHistoryV2FromIndexHistory } from "./panicHistoryV2Db.js"
import { persistPanicPayload } from "./panicPipeline.js"
import {
  coercePanicSavePayload,
  stripNilEntries,
  validatePanicSavePayload,
} from "./panicSaveValidate.js"

export function panicNoStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
  res.setHeader("Pragma", "no-cache")
  res.setHeader("Expires", "0")
}

function queryParams(req) {
  return new URL(req.url || "", "http://localhost").searchParams
}

/** mode=latest — 허브 스냅샷 (구 /api/panic/latest) */
export async function handlePanicModeLatest(req, res) {
  const respondEmergency = (reason, error) => {
    if (error) console.error("[panic] mode=latest", error)
    const data = panicEmergencyHubData()
    res.status(200).json({
      ok: true,
      success: false,
      data,
      dataRows: PANIC_EMERGENCY_ROWS,
      emergency: true,
      reason: reason ?? "emergency_fallback",
      meta: { isStale: true, rowCount: 0, sources: [] },
      rowCount: 0,
      empty: false,
    })
  }

  try {
  if (req.query?.probe === "1" || req.query?.probeInsert === "1") {
    try {
      const probe = await probePanicMetricsNumericInsert()
      res.status(200).json({ ok: true, success: true, probe })
    } catch (error) {
      respondEmergency("probe_failed", error)
    }
    return
  }

  if (!isSupabaseConfigured()) {
    respondEmergency("supabase_not_configured")
    return
  }

  let latestRow = null
  let historyRow = null
  let rows = []

  try {
    latestRow = await fetchLatestPanicMetricsRow()
  } catch (err) {
    console.warn("[panic] latest_panic_metrics", err)
  }
  try {
    historyRow = await fetchLatestPanicIndexHistoryCore()
  } catch (err) {
    console.warn("[panic] panic_index_history", err)
  }
  try {
    rows = await fetchPanicMetricsRows()
  } catch (err) {
    console.warn("[panic] panic_metrics", err)
    rows = []
  }

  const fromLatest = panicObjectFromLatestRow(latestRow)
  const fromHistory = panicObjectFromHistoryCoreRow(historyRow)
  const fromEav = rows?.length ? panicObjectFromRows(rows) : null
  const data = fromLatest ?? fromHistory ?? fromEav

  if (!data) {
    respondEmergency("no_db_rows")
    return
  }

  const meta = computePanicServeMeta(rows, data)
  res.status(200).json({
    ok: true,
    success: true,
    data,
    meta,
    rowCount: Array.isArray(rows) ? rows.length : 0,
    empty: false,
    sources: {
      latest_panic_metrics: Boolean(latestRow),
      panic_index_history: Boolean(historyRow),
      panic_metrics: rows.length > 0,
    },
  })
  } catch (error) {
    respondEmergency("handler_catch", error)
  }
}

/** mode=history — panic_index_history 목록 (구 /api/panic/history) */
export async function handlePanicModeHistory(req, res) {
  if (!isSupabaseConfigured()) {
    res.status(503).json({ ok: false, error: "supabase_not_configured", rows: [] })
    return
  }
  try {
    const q = queryParams(req)
    const limit = q.get("limit")
    const from = q.get("from")
    const to = q.get("to")
    const rows = await fetchPanicIndexHistoryRows({ limit, from, to })
    const includeCycle = q.get("cycle") === "1"
    let cycleRows = []
    if (includeCycle) {
      const raw = await fetchMarketCycleHistoryRows({ limit, from, to })
      cycleRows = raw.map(marketCycleRowToClient).filter(Boolean)
    }
    console.log("[YDS_DATA] reliability:api-server", {
      stage: "api",
      dbRows: rows.length,
      cycleRows: cycleRows.length,
      limit,
      from: from || null,
      to: to || null,
    })
    res.status(200).json({
      ok: true,
      rows,
      cycleRows: includeCycle ? cycleRows : undefined,
      meta: { dbRowCount: rows.length, cycleRowCount: cycleRows.length },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed"
    console.warn("[panic] mode=history", msg)
    res.status(200).json({ ok: true, warning: msg, rows: [], cycleRows: undefined })
  }
}

/** mode=historylatest — 최신 1건 (구 /api/panic/history/latest) */
export async function handlePanicModeHistoryLatest(req, res) {
  if (!isSupabaseConfigured()) {
    res.status(503).json({ ok: false, error: "supabase_not_configured", row: null })
    return
  }
  try {
    const rows = await fetchPanicIndexHistoryRows({ limit: 1 })
    const row = rows.length ? rows[rows.length - 1] : null
    res.status(200).json({ ok: true, row, rows: row ? [row] : [] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed"
    console.warn("[panic] mode=historylatest", msg)
    res.status(200).json({ ok: true, warning: msg, row: null, rows: [] })
  }
}

/** mode=v2 | v2history — panic_history_v2 (구 /api/panic/history-v2) */
export async function handlePanicModeV2History(req, res) {
  if (!isSupabaseConfigured()) {
    res.status(200).json({ ok: true, warning: "supabase_not_configured", rows: [], count: 0 })
    return
  }
  try {
    const q = queryParams(req)
    const rows = await fetchPanicHistoryV2Rows({
      limit: q.get("limit"),
      from: q.get("from"),
      to: q.get("to"),
    })
    res.status(200).json({ ok: true, rows, count: rows.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed"
    console.warn("[panic] mode=v2history", msg)
    res.status(200).json({ ok: true, warning: msg, rows: [], count: 0 })
  }
}

/** mode=backfill — V2 백필 (구 /api/panic/history-v2/backfill) */
export async function handlePanicModeBackfill(req, res) {
  if (!isSupabaseConfigured()) {
    res.status(200).json({ ok: true, warning: "supabase_not_configured", skipped: true })
    return
  }
  try {
    const q = queryParams(req)
    const body = typeof req.body === "object" && req.body ? req.body : {}
    const limit = body.limit ?? q.get("limit")
    const days = body.days ?? q.get("days") ?? 30
    const result = await backfillPanicHistoryV2FromIndexHistory({
      limit,
      days,
      source: body.source ?? "api_backfill",
    })
    res.status(200).json({ ok: true, ...result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "backfill_failed"
    console.warn("[panic] mode=backfill", msg)
    res.status(200).json({ ok: true, warning: msg, skipped: true })
  }
}

/** mode=update — 저장 (구 POST /api/panic/update) */
export async function handlePanicModeUpdate(req, res) {
  if (!isSupabaseConfigured()) {
    res.status(503).json({ ok: false, error: "supabase_not_configured" })
    return
  }
  let savePayload = {}
  try {
    const raw = typeof req.body === "object" && req.body ? req.body : {}
    savePayload = coercePanicSavePayload(stripNilEntries(raw))
    const validation = validatePanicSavePayload(savePayload)
    if (!validation.ok) {
      res.status(400).json({
        ok: false,
        error: validation.error,
        message: validation.error,
        missing: validation.missing,
        payload: savePayload,
        stage: "validation",
      })
      return
    }
    const result = await persistPanicPayload(savePayload, { source: "manual", requireHistory: true })
    if (!result.history?.ok) {
      res.status(422).json({
        ok: false,
        error: result.history?.reason || result.history?.error || "panic_index_history_upsert_failed",
        data: result.data,
        history: result.history,
        meta: result.meta,
        panicHistoryV2: result.panicHistoryV2,
      })
      return
    }
    res.status(200).json({
      ok: true,
      data: result.data,
      history: result.history,
      panicHistoryV2: result.panicHistoryV2,
      meta: result.meta,
      report: result.report ?? null,
      reportKey: result.reportKey ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "update_failed")
    const stage = error && typeof error === "object" && "stage" in error ? error.stage : "pipeline"
    res.status(500).json({
      ok: false,
      message,
      error: message,
      payload: savePayload,
      stage,
    })
  }
}
