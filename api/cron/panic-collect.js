import { isSupabaseConfigured } from "../_lib/supabaseRest.js"
import { verifyCronRequest } from "../_lib/cronAuth.js"
import {
  runCreditSpreadsCollectJob,
  runPanicCollectJob,
} from "../_lib/panicPipeline.js"

function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
  res.setHeader("Pragma", "no-cache")
  res.setHeader("Expires", "0")
}

function truthyQuery(v) {
  return v === "1" || v === "true" || v === true
}

/**
 * Vercel Cron → 외부 지표 수집 → Supabase upsert (latest + history)
 *
 * HY/BBB 수동(Preview): Authorization Bearer CRON_SECRET
 *   + ?credit=1&force=1  (화·금 KST 가드 우회; Hobby 12함수 한도로 별도 cron 파일 없음)
 * 일일 Cron은 기본 경로에서 Tue/Fri KST일 때만 credit 수집을 내부 호출한다.
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

  const creditOnly =
    truthyQuery(req.query?.credit) ||
    req.query?.mode === "credit-spreads" ||
    req.body?.mode === "credit-spreads"
  const force =
    truthyQuery(req.query?.force) ||
    truthyQuery(req.body?.force)

  try {
    if (creditOnly) {
      const result = await runCreditSpreadsCollectJob({ force })
      res.status(200).json({
        ok: true,
        mode: "credit-spreads",
        force: Boolean(force),
        ...result,
      })
      return
    }

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
