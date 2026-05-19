import { isSupabaseConfigured } from "../_lib/supabaseRest.js"
import {
  fetchLatestPanicMetricsRow,
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
    const latestRow = await fetchLatestPanicMetricsRow().catch(() => null)
    const rows = await fetchPanicMetricsRows()
    const fromLatest = panicObjectFromLatestRow(latestRow)
    const fromEav = rows?.length ? panicObjectFromRows(rows) : null
    const data = fromLatest ?? fromEav
    const meta = computePanicServeMeta(rows, data)
    const rowCount = Array.isArray(rows) ? rows.length : 0
    const hasData = Boolean(data)
    res.status(200).json({
      ok: true,
      data: hasData ? data : null,
      meta,
      rowCount,
      empty: !hasData,
      hint: !hasData ? "Run supabase/migrations or POST /api/cron/panic-collect" : null,
    })
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : "fetch_failed",
      data: null,
    })
  }
}
