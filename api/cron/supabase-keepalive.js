import { isSupabaseConfigured, supabaseRest } from "../_lib/supabaseRest.js"

function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
  res.setHeader("Pragma", "no-cache")
  res.setHeader("Expires", "0")
}

/**
 * Supabase Free Plan inactivity pause 예방 — SELECT only.
 * CRON_SECRET 불필요. INSERT/UPDATE 없음. Panic Index 데이터 미변경.
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
    const rows = await supabaseRest("panic_metrics?select=metric_key&limit=1", {
      method: "GET",
    })
    res.status(200).json({
      ok: true,
      purpose: "supabase_free_pause_keepalive",
      table: "panic_metrics",
      hit: Array.isArray(rows) && rows.length > 0,
      write: false,
      checkedAt: new Date().toISOString(),
    })
  } catch (e) {
    console.error("[cron/supabase-keepalive]", e)
    res.status(200).json({
      ok: false,
      purpose: "supabase_free_pause_keepalive",
      write: false,
      error: e instanceof Error ? e.message : "keepalive_failed",
      checkedAt: new Date().toISOString(),
    })
  }
}
