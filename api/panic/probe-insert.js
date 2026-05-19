import { isSupabaseConfigured } from "../_lib/supabaseRest.js"
import { probePanicMetricsNumericInsert } from "../_lib/panicMetricsHub.js"

function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
}

/**
 * GET /api/panic/probe-insert
 * Fixed metric_value=17.82 (number) upsert — diagnose DB trigger/RPC vs payload.
 */
export default async function handler(req, res) {
  noStore(res)
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" })
    return
  }
  if (!isSupabaseConfigured()) {
    res.status(503).json({ ok: false, error: "supabase_not_configured" })
    return
  }
  try {
    console.log("PROBE_INSERT_ROUTE_START")
    const result = await probePanicMetricsNumericInsert()
    res.status(200).json({
      ok: true,
      ...result,
      hint: "PROBE_INSERT_SUCCESS → DB accepts numeric metric_value; failure on /update → server payload issue",
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "probe_insert_failed"
    console.error("PROBE_INSERT_ROUTE_FAILED", message)
    res.status(500).json({
      ok: false,
      error: message,
      hint: "PROBE_INSERT_FAILED → check Supabase triggers, RPC, views on panic_metrics",
    })
  }
}
