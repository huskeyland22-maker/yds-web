import { isSupabaseConfigured } from "../_lib/supabaseRest.js"
import { fetchMarketStatusRows } from "../_lib/marketStatus.js"

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
    res.status(503).json({ ok: false, error: "supabase_not_configured", rows: [] })
    return
  }
  try {
    const url = new URL(req.url || "", "http://localhost")
    const market = url.searchParams.get("market") || undefined
    const rows = await fetchMarketStatusRows({ market })
    res.status(200).json({ ok: true, rows })
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : "fetch_failed",
      rows: [],
    })
  }
}
