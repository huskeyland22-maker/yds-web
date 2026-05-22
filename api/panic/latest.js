import { isSupabaseConfigured } from "../_lib/supabaseRest.js"
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
import { computePanicServeMeta } from "../_lib/panicPipeline.js"

function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
  res.setHeader("Pragma", "no-cache")
  res.setHeader("Expires", "0")
}

export default async function handler(req, res) {
  noStore(res)
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed" })
    return
  }
  if (!isSupabaseConfigured()) {
    res.status(503).json({ ok: false, error: "supabase_not_configured", data: null })
    return
  }
  try {
    if (req.query?.probe === "1" || req.query?.probeInsert === "1") {
      const probe = await probePanicMetricsNumericInsert()
      res.status(200).json({ ok: true, probe })
      return
    }

    let latestRow = null
    let historyRow = null
    let rows = []

    try {
      latestRow = await fetchLatestPanicMetricsRow()
    } catch (err) {
      console.warn("[panic/latest] latest_panic_metrics fetch failed", err)
    }

    try {
      historyRow = await fetchLatestPanicIndexHistoryCore()
    } catch (err) {
      console.warn("[panic/latest] panic_index_history fetch failed", err)
    }

    try {
      rows = await fetchPanicMetricsRows()
    } catch (err) {
      console.warn("[panic/latest] panic_metrics fetch failed", err)
      rows = []
    }

    if (!latestRow && !historyRow && (!rows || !rows.length)) {
      res.status(200).json({
        ok: true,
        data: [],
        meta: { isStale: true, rowCount: 0, sources: [] },
        rowCount: 0,
        empty: true,
        hint: "panic_index_history / latest_panic_metrics empty — run migration or POST /api/panic/update",
      })
      return
    }

    const fromLatest = panicObjectFromLatestRow(latestRow)
    const fromHistory = panicObjectFromHistoryCoreRow(historyRow)
    const fromEav = rows?.length ? panicObjectFromRows(rows) : null
    const data = fromLatest ?? fromHistory ?? fromEav
    const meta = computePanicServeMeta(rows, data)
    const rowCount = Array.isArray(rows) ? rows.length : 0
    const hasData = Boolean(data)

    res.status(200).json({
      ok: true,
      data: hasData ? data : null,
      meta,
      rowCount,
      empty: !hasData,
      sources: {
        latest_panic_metrics: Boolean(latestRow),
        panic_index_history: Boolean(historyRow),
        panic_metrics: rowCount > 0,
      },
      hint: !hasData ? "Run supabase/migrations or POST /api/cron/panic-collect" : null,
    })
  } catch (error) {
    console.error("panic latest error", error)
    const message = error instanceof Error ? error.message : String(error ?? "fetch_failed")
    const stack = error instanceof Error ? error.stack : undefined
    res.status(500).json({
      ok: false,
      message,
      error: message,
      stack,
      data: null,
    })
  }
}
