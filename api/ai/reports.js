import { isSupabaseConfigured } from "../_lib/supabaseRest.js"
import { aiReportToClient, fetchAiReportRows } from "../_lib/aiReports.js"

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
    const reportKey = url.searchParams.get("report_key") || url.searchParams.get("key") || undefined
    const limit = url.searchParams.get("limit")
    const raw = await fetchAiReportRows({ reportKey, limit })
    const rows = raw.map(aiReportToClient).filter(Boolean)
    res.status(200).json({ ok: true, rows })
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : "fetch_failed",
      rows: [],
    })
  }
}
