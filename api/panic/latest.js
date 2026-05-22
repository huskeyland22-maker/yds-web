import { isSupabaseConfigured } from "../_lib/supabaseRest.js"
import { panicEmergencyHubData, PANIC_EMERGENCY_ROWS } from "../_lib/panicEmergencyFallback.js"
import {
  fetchLatestPanicIndexHistoryCore,
  fetchLatestPanicMetricsRow,
  panicObjectFromHistoryCoreRow,
  panicObjectFromLatestRow,
} from "../_lib/latestPanicMetrics.js"
import {
  fetchPanicMetricsRows,
  panicObjectFromRows,
  probePanicMetricsNumericInsert,
} from "../_lib/panicMetricsHub.js"
import { computePanicServeMeta } from "../_lib/panicServeMeta.js"

function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
  res.setHeader("Pragma", "no-cache")
  res.setHeader("Expires", "0")
}

/** 절대 500 금지 — 항상 200 */
function respondEmergency(res, reason, error) {
  if (error) console.error("panic latest", error)
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

export default async function handler(req, res) {
  noStore(res)
  if (req.method !== "GET") {
    res.status(200).json({ ok: false, success: false, data: [], error: "method_not_allowed" })
    return
  }

  try {
    if (req.query?.probe === "1" || req.query?.probeInsert === "1") {
      try {
        const probe = await probePanicMetricsNumericInsert()
        res.status(200).json({ ok: true, success: true, probe })
      } catch (error) {
        respondEmergency(res, "probe_failed", error)
      }
      return
    }

    if (!isSupabaseConfigured()) {
      respondEmergency(res, "supabase_not_configured")
      return
    }

    let latestRow = null
    let historyRow = null
    let rows = []

    try {
      latestRow = await fetchLatestPanicMetricsRow()
    } catch (err) {
      console.warn("[panic/latest] latest_panic_metrics", err)
    }

    try {
      historyRow = await fetchLatestPanicIndexHistoryCore()
    } catch (err) {
      console.warn("[panic/latest] panic_index_history", err)
    }

    try {
      rows = await fetchPanicMetricsRows()
    } catch (err) {
      console.warn("[panic/latest] panic_metrics", err)
      rows = []
    }

    const fromLatest = panicObjectFromLatestRow(latestRow)
    const fromHistory = panicObjectFromHistoryCoreRow(historyRow)
    const fromEav = rows?.length ? panicObjectFromRows(rows) : null
    const data = fromLatest ?? fromHistory ?? fromEav

    if (!data) {
      respondEmergency(res, "no_db_rows")
      return
    }

    const meta = computePanicServeMeta(rows, data)
    const rowCount = Array.isArray(rows) ? rows.length : 0

    res.status(200).json({
      ok: true,
      success: true,
      data,
      meta,
      rowCount,
      empty: false,
      sources: {
        latest_panic_metrics: Boolean(latestRow),
        panic_index_history: Boolean(historyRow),
        panic_metrics: rowCount > 0,
      },
    })
  } catch (error) {
    respondEmergency(res, "handler_catch", error)
  }
}
