import { isSupabaseConfigured } from "../_lib/supabaseRest.js"
import { verifyCronRequest } from "../_lib/cronAuth.js"
import { runCreditSpreadsCollectJob } from "../_lib/panicPipeline.js"

function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
  res.setHeader("Pragma", "no-cache")
  res.setHeader("Expires", "0")
}

/**
 * HY OAS + BBB OAS 수집.
 * - 스케줄: panic-collect 일일 Cron 내부에서도 화·금 KST만 실행
 * - Preview 수동: Authorization Bearer CRON_SECRET + ?force=1 (요일 가드 우회)
 */
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

  const force =
    req.query?.force === "1" ||
    req.query?.force === "true" ||
    req.body?.force === true ||
    req.body?.force === "1"

  try {
    const result = await runCreditSpreadsCollectJob({ force })
    res.status(200).json({
      ok: true,
      force: Boolean(force),
      ...result,
    })
  } catch (e) {
    console.error("[cron/credit-spreads-collect]", e)
    res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : "collect_failed",
    })
  }
}
