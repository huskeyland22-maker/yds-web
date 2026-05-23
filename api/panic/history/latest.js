import { isSupabaseConfigured } from "../../_lib/supabaseRest.js"
import { fetchPanicIndexHistoryRows } from "../../_lib/panicIndexHistory.js"

function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
  res.setHeader("Pragma", "no-cache")
  res.setHeader("Expires", "0")
}

/** GET — panic_index_history 최신 1건 (date desc) */
export default async function handler(req, res) {
  noStore(res)
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed" })
    return
  }
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
    console.warn("[panic/history/latest]", msg)
    res.status(200).json({
      ok: true,
      warning: msg,
      row: null,
      rows: [],
    })
  }
}
