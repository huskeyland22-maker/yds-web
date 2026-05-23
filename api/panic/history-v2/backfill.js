import { isSupabaseConfigured } from "../../_lib/supabaseRest.js"
import { backfillPanicHistoryV2FromIndexHistory } from "../../_lib/panicHistoryV2Db.js"

function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
  res.setHeader("Pragma", "no-cache")
  res.setHeader("Expires", "0")
}

/** POST — panic_index_history → panic_history_v2 백필 */
export default async function handler(req, res) {
  noStore(res)
  if (req.method !== "POST" && req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed" })
    return
  }
  if (!isSupabaseConfigured()) {
    res.status(200).json({ ok: true, warning: "supabase_not_configured", skipped: true })
    return
  }
  try {
    const url = new URL(req.url || "", "http://localhost")
    const body = typeof req.body === "object" && req.body ? req.body : {}
    const limit = body.limit ?? url.searchParams.get("limit")
    const result = await backfillPanicHistoryV2FromIndexHistory({
      limit,
      source: body.source ?? "api_backfill",
    })
    res.status(200).json({ ok: true, ...result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "backfill_failed"
    console.warn("[panic/history-v2/backfill]", msg)
    res.status(200).json({ ok: true, warning: msg, skipped: true })
  }
}
