import { isSupabaseConfigured } from "../_lib/supabaseRest.js"
import { aiReportToClient, fetchAiReportRows } from "../_lib/aiReports.js"
import { dailyReportToClient, fetchDailyAiReportByDate, fetchDailyAiReports } from "../_lib/dailyAiReports.js"

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
    const daily = url.searchParams.get("daily") === "1"
    const date = url.searchParams.get("date")

    if (daily) {
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(String(date).slice(0, 10))) {
        const row = await fetchDailyAiReportByDate(String(date).slice(0, 10))
        res.status(200).json({ ok: true, rows: row ? [row] : [], row })
        return
      }
      const rows = await fetchDailyAiReports({ limit })
      res.status(200).json({ ok: true, rows })
      return
    }

    const raw = await fetchAiReportRows({ reportKey, limit })
    const rows = raw.map(aiReportToClient).filter(Boolean)
    res.status(200).json({ ok: true, rows })
  } catch (e) {
    const message = e instanceof Error ? e.message : "fetch_failed"
    const stack = e instanceof Error ? e.stack : null
    console.error("[api/ai/reports] handler failed", {
      message,
      stack,
      url: req.url ?? null,
    })
    const isSoft = /does not exist|timeout|timed out|statement timeout|canceling statement/i.test(message)
    if (isSoft) {
      res.status(200).json({
        ok: true,
        rows: [],
        warning: message,
        degraded: true,
      })
      return
    }
    res.status(500).json({
      ok: false,
      error: message,
      stack,
      rows: [],
    })
  }
}
