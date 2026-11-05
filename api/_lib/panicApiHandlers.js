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
import {
  fetchPanicMirrorJson,
  isUsablePanicHistoryLatestMirror,
  isUsablePanicLatestMirror,
} from "./panicPreviewMirror.js"
import { mapPanicPersistSchemaError } from "./panicSchemaErrors.js"

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
  let data = fromLatest ?? fromHistory ?? fromEav
  let mirrored = false

  if (!data) {
    const mirror = await fetchPanicMirrorJson("/api/panic?mode=latest")
    if (mirror?.ok && isUsablePanicLatestMirror(mirror.json)) {
      const mirroredJson = mirror.json
      mirrored = true
      res.status(200).json({
        ...mirroredJson,
        meta: {
          ...(mirroredJson.meta && typeof mirroredJson.meta === "object" ? mirroredJson.meta : {}),
          mirroredFrom: "preview_read_mirror",
        },
        sources: {
          ...(mirroredJson.sources && typeof mirroredJson.sources === "object"
            ? mirroredJson.sources
            : {}),
          preview_read_mirror: true,
        },
      })
      return
    }
    respondEmergency(mirrored ? "mirror_empty" : "no_db_rows")
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
      try {
        const raw = await fetchMarketCycleHistoryRows({ limit, from, to })
        cycleRows = raw.map(marketCycleRowToClient).filter(Boolean)
      } catch (e) {
        console.warn("[panic] market_cycle_history skip", e instanceof Error ? e.message : e)
        cycleRows = []
      }
    }
    console.log("[YDS_DATA] reliability:api-server", {
      stage: "api",
      dbRows: rows.length,
      cycleRows: cycleRows.length,
      limit,
      from: from || null,
      to: to || null,
    })
    if (rows.length < 1) {
      const qs = new URLSearchParams({ mode: "history" })
      if (limit) qs.set("limit", String(limit))
      if (from) qs.set("from", String(from))
      if (to) qs.set("to", String(to))
      if (includeCycle) qs.set("cycle", "1")
      const mirror = await fetchPanicMirrorJson(`/api/panic?${qs}`)
      const mirroredRows = Array.isArray(mirror?.json?.rows) ? mirror.json.rows : []
      if (mirror?.ok && mirroredRows.length > 0) {
        res.status(200).json({
          ...mirror.json,
          meta: {
            ...(mirror.json.meta && typeof mirror.json.meta === "object" ? mirror.json.meta : {}),
            dbRowCount: mirroredRows.length,
            mirroredFrom: "preview_read_mirror",
          },
        })
        return
      }
    }
    res.status(200).json({
      ok: true,
      rows,
      cycleRows: includeCycle ? cycleRows : undefined,
      meta: { dbRowCount: rows.length, cycleRowCount: cycleRows.length },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed"
    console.warn("[panic] mode=history", msg)
    const qs = new URLSearchParams({ mode: "history", limit: "120" })
    const mirror = await fetchPanicMirrorJson(`/api/panic?${qs}`)
    const mirroredRows = Array.isArray(mirror?.json?.rows) ? mirror.json.rows : []
    if (mirror?.ok && mirroredRows.length > 0) {
      res.status(200).json({
        ...mirror.json,
        warning: msg,
        meta: {
          ...(mirror.json.meta && typeof mirror.json.meta === "object" ? mirror.json.meta : {}),
          mirroredFrom: "preview_read_mirror",
        },
      })
      return
    }
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
    if (row) {
      res.status(200).json({ ok: true, row, rows: [row] })
      return
    }
    const mirror = await fetchPanicMirrorJson("/api/panic?mode=history-latest")
    if (mirror?.ok && isUsablePanicHistoryLatestMirror(mirror.json)) {
      res.status(200).json({
        ...mirror.json,
        meta: {
          ...(mirror.json.meta && typeof mirror.json.meta === "object" ? mirror.json.meta : {}),
          mirroredFrom: "preview_read_mirror",
        },
      })
      return
    }
    res.status(200).json({ ok: true, row: null, rows: [] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed"
    console.warn("[panic] mode=historylatest", msg)
    const mirror = await fetchPanicMirrorJson("/api/panic?mode=history-latest")
    if (mirror?.ok && isUsablePanicHistoryLatestMirror(mirror.json)) {
      res.status(200).json({
        ...mirror.json,
        warning: msg,
        meta: { mirroredFrom: "preview_read_mirror" },
      })
      return
    }
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
      const isIncomplete = validation.code === "INCOMPLETE_CORE_METRICS"
      res.status(400).json({
        ok: false,
        code: validation.code ?? (isIncomplete ? "INCOMPLETE_CORE_METRICS" : "missing_required"),
        missing: validation.missing,
        message:
          validation.message ||
          (isIncomplete
            ? "핵심 Panic Index 3개(VIX · CNN Fear & Greed · Put/Call)가 모두 입력되어야 저장할 수 있습니다."
            : validation.error),
        error: validation.error,
        payload: savePayload,
        stage: "validation",
      })
      return
    }
    const result = await persistPanicPayload(savePayload, { source: "manual", requireHistory: true })
    if (!result.history?.ok) {
      const reason = result.history?.reason || result.history?.error || "panic_index_history_upsert_failed"
      const isIncomplete =
        reason === "incomplete_core_metrics" || result.history?.code === "INCOMPLETE_CORE_METRICS"
      if (isIncomplete) {
        res.status(400).json({
          ok: false,
          code: "INCOMPLETE_CORE_METRICS",
          missing: result.history?.missing ?? [],
          message:
            result.history?.message ||
            "핵심 Panic Index 3개(VIX · CNN Fear & Greed · Put/Call)가 모두 입력되어야 저장할 수 있습니다.",
          error: reason,
          history: result.history,
          stage: "validation",
        })
        return
      }
      res.status(422).json({
        ok: false,
        error: reason,
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
    const mapped = mapPanicPersistSchemaError(error)
    const schemaErr =
      mapped && typeof mapped === "object" && typeof mapped.code === "string" ? mapped : error
    const message = schemaErr instanceof Error ? schemaErr.message : String(schemaErr ?? "update_failed")
    const stage =
      schemaErr && typeof schemaErr === "object" && "stage" in schemaErr ? schemaErr.stage : "pipeline"
    const statusCode =
      schemaErr && typeof schemaErr === "object" && Number(schemaErr.statusCode) >= 400
        ? Number(schemaErr.statusCode)
        : 500
    const code =
      schemaErr && typeof schemaErr === "object" && typeof schemaErr.code === "string"
        ? schemaErr.code
        : undefined
    const missing =
      schemaErr && typeof schemaErr === "object" && Array.isArray(schemaErr.missing)
        ? schemaErr.missing
        : undefined
    const detail =
      schemaErr && typeof schemaErr === "object" && typeof schemaErr.detail === "string"
        ? schemaErr.detail
        : undefined
    const hint =
      schemaErr && typeof schemaErr === "object" && typeof schemaErr.hint === "string"
        ? schemaErr.hint
        : undefined
    const retryable =
      schemaErr && typeof schemaErr === "object" && schemaErr.retryable === true ? true : undefined
    res.status(statusCode).json({
      ok: false,
      ...(code ? { code } : {}),
      ...(missing ? { missing } : {}),
      ...(detail ? { detail } : {}),
      ...(hint ? { hint } : {}),
      ...(retryable ? { retryable: true } : {}),
      message,
      error: message,
      payload: savePayload,
      stage,
    })
  }
}
