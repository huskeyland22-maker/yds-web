import { isSupabaseConfigured } from "../_lib/supabaseRest.js"
import { verifyCronRequest } from "../_lib/cronAuth.js"
import { runPanicCollectJob } from "../_lib/panicPipeline.js"

function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
  res.setHeader("Pragma", "no-cache")
  res.setHeader("Expires", "0")
}

/** Vercel Cron → 외부 지표 수집 → Supabase upsert (latest + history) */
export default async function handler(req, res) {
  noStore(res)
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" })
    return
  }

  const auth = verifyCronRequest(req)
  if (!auth.ok) {
    res.status(auth.status || 401).json({ ok: false, error: auth.error })
    return
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({ ok: false, error: "supabase_not_configured" })
    return
  }

  try {
    const result = await runPanicCollectJob()
    res.status(200).json({
      ok: true,
      ...result,
    })
  } catch (e) {
    console.error("[cron/panic-collect]", e)
    res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : "collect_failed",
    })
  }
}
