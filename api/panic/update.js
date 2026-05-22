import { isSupabaseConfigured } from "../_lib/supabaseRest.js"
import { persistPanicPayload } from "../_lib/panicPipeline.js"
import { stripUndefinedEntries, validatePanicSavePayload } from "../_lib/panicSaveValidate.js"

function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
  res.setHeader("Pragma", "no-cache")
  res.setHeader("Expires", "0")
}

export default async function handler(req, res) {
  noStore(res)
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" })
    return
  }
  if (!isSupabaseConfigured()) {
    res.status(503).json({ ok: false, error: "supabase_not_configured" })
    return
  }
  try {
    const incoming = stripUndefinedEntries(
      typeof req.body === "object" && req.body ? req.body : {},
    )
    console.log("save payload", incoming)
    console.log(JSON.stringify(incoming, null, 2))

    const validation = validatePanicSavePayload(incoming)
    if (!validation.ok) {
      console.error("[panic/update] validation_failed", validation.missing)
      res.status(400).json({
        ok: false,
        error: validation.error,
        missing: validation.missing,
        stage: "validation",
      })
      return
    }

    console.log("SAVE_PAYLOAD_SERVER", "route-entry")
    console.log("[panic/update] route-body")
    for (const key of ["vix", "vxn", "fearGreed", "putCall", "bofa", "move", "skew", "highYield", "gsBullBear"]) {
      if (key in incoming) {
        console.log("[panic/update]", key, incoming[key], typeof incoming[key])
      }
    }
    const result = await persistPanicPayload(incoming, { source: "manual", requireHistory: true })
    if (!result.history?.ok) {
      res.status(422).json({
        ok: false,
        error: result.history?.reason || result.history?.error || "panic_index_history_upsert_failed",
        data: result.data,
        history: result.history,
        meta: result.meta,
      })
      return
    }
    res.status(200).json({
      ok: true,
      data: result.data,
      history: result.history,
      meta: result.meta,
      report: result.report ?? null,
      reportKey: result.reportKey ?? null,
    })
  } catch (e) {
    console.error("panic save error", e)
    const message = e instanceof Error ? e.message : String(e ?? "update_failed")
    const stack = e instanceof Error ? e.stack : undefined
    const stage = e && typeof e === "object" && "stage" in e ? e.stage : "pipeline"
    res.status(500).json({
      ok: false,
      error: message,
      stack,
      stage,
    })
  }
}
