import { fetchSupabaseTableHealth } from "../_lib/supabaseHealth.js"
import { verifyPanicHistoryStorage } from "../_lib/panicHistoryVerify.js"

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
  try {
    const url = new URL(req.url || "", "http://localhost")
    const panicVerify = url.searchParams.get("panic_verify") === "1"

    if (panicVerify) {
      const report = await verifyPanicHistoryStorage()
      res.status(report.ok ? 200 : 503).json(report)
      return
    }

    const health = await fetchSupabaseTableHealth()
    res.status(health.ok ? 200 : 503).json(health)
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : "health_failed",
      tables: {},
    })
  }
}
