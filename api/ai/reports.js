import { isSupabaseConfigured } from "../_lib/supabaseRest.js"
import { aiReportToClient, fetchAiReportRows } from "../_lib/aiReports.js"
import { dailyReportToClient, fetchDailyAiReportByDate, fetchDailyAiReports } from "../_lib/dailyAiReports.js"

function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
  res.setHeader("Pragma", "no-cache")
  res.setHeader("Expires", "0")
}

function safeOk(res, body) {
  res.status(200).json({
    ok: false,
    degraded: true,
    reports: [],
    rows: [],
    ...body,
  })
}

async function withTimeout(promise, ms, label) {
  let timer = null
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}_timeout_${ms}ms`)), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export default async function handler(req, res) {
  noStore(res)
  const payload = {
    method: req.method ?? null,
    url: req.url ?? null,
    query: req.query ?? null,
    now: new Date().toISOString(),
  }
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed" })
    return
  }
  if (!isSupabaseConfigured()) {
    safeOk(res, { error: "supabase_not_configured" })
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
        const row = await withTimeout(fetchDailyAiReportByDate(String(date).slice(0, 10)), 5000, "daily_report")
        const safeRow = row && typeof row === "object" ? row : null
        const reports = safeRow ? [safeRow] : []
        res.status(200).json({ ok: true, degraded: false, reports, rows: reports, row: safeRow })
        return
      }
      const rows = await withTimeout(fetchDailyAiReports({ limit }), 5000, "daily_reports")
      const reports = Array.isArray(rows) ? rows : []
      res.status(200).json({ ok: true, degraded: false, reports, rows: reports })
      return
    }

    const raw = await withTimeout(fetchAiReportRows({ reportKey, limit }), 5000, "ai_reports")
    const rows = (Array.isArray(raw) ? raw : []).map((row) => aiReportToClient(row)).filter(Boolean)
    res.status(200).json({ ok: true, degraded: false, reports: rows, rows })
  } catch (e) {
    const message = e instanceof Error ? e.message : "fetch_failed"
    const stack = e instanceof Error ? e.stack : null
    console.error(
      "[AI REPORT ERROR]",
      e,
      stack,
      JSON.stringify(
        {
          ...payload,
          message,
        },
        null,
        2,
      ),
    )
    safeOk(res, {
      error: message,
      stack,
      warning: message,
    })
  }
}
