import { isSupabaseConfigured } from "../_lib/supabaseRest.js"
import { fetchPanicHistoryV2Rows } from "../_lib/panicHistoryV2Db.js"

function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
  res.setHeader("Pragma", "no-cache")
  res.setHeader("Expires", "0")
}

/** GET — panic_history_v2 목록 */
export default async function handler(req, res) {
  noStore(res)
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed" })
    return
  }
  if (!isSupabaseConfigured()) {
    res.status(200).json({ ok: true, warning: "supabase_not_configured", rows: [] })
    return
  }
  try {
    const url = new URL(req.url || "", "http://localhost")
    const limit = url.searchParams.get("limit")
    const from = url.searchParams.get("from")
    const to = url.searchParams.get("to")
    const rows = await fetchPanicHistoryV2Rows({ limit, from, to })
    res.status(200).json({ ok: true, rows, count: rows.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed"
    console.warn("[panic/history-v2]", msg)
    res.status(200).json({ ok: true, warning: msg, rows: [], count: 0 })
  }
}
