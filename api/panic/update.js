import { isSupabaseConfigured } from "../_lib/supabaseRest.js"
import {
  fetchPanicMetricsRows,
  panicObjectFromRows,
  rowsFromPanicPayload,
  upsertPanicMetricsRows,
} from "../_lib/panicMetricsHub.js"
import { upsertPanicIndexHistoryFromPayload } from "../_lib/panicIndexHistory.js"

function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
  res.setHeader("Pragma", "no-cache")
  res.setHeader("Expires", "0")
}

export default async function handler(req, res) {
  noStore(res)
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" })
    return
  }
  if (!isSupabaseConfigured()) {
    res.status(503).json({ ok: false, error: "supabase_not_configured" })
    return
  }
  try {
    const incoming = typeof req.body === "object" && req.body ? req.body : {}
    const rows = rowsFromPanicPayload(incoming)
    await upsertPanicMetricsRows(rows)
    let history = { ok: false, skipped: true }
    try {
      history = await upsertPanicIndexHistoryFromPayload(incoming)
    } catch (historyErr) {
      console.warn("[panic/update] history append failed", historyErr)
      history = {
        ok: false,
        error: historyErr instanceof Error ? historyErr.message : "history_failed",
      }
    }
    const fresh = await fetchPanicMetricsRows()
    const data = panicObjectFromRows(fresh)
    res.status(200).json({ ok: true, data, history })
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : "update_failed",
    })
  }
}
