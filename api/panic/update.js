import { isSupabaseConfigured } from "../_lib/supabaseRest.js"
import { persistPanicPayload } from "../_lib/panicPipeline.js"
import {
  coercePanicSavePayload,
  stripNilEntries,
  validatePanicSavePayload,
} from "../_lib/panicSaveValidate.js"

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
  let savePayload = {}
  try {
    const raw =
      typeof req.body === "object" && req.body ? req.body : {}
    savePayload = coercePanicSavePayload(stripNilEntries(raw))
    console.log("save payload", JSON.stringify(savePayload, null, 2))

    const validation = validatePanicSavePayload(savePayload)
    if (!validation.ok) {
      console.error("[panic/update] validation_failed", validation.missing)
      res.status(400).json({
        ok: false,
        error: validation.error,
        message: validation.error,
        missing: validation.missing,
        payload: savePayload,
        stage: "validation",
      })
      return
    }

    console.log("SAVE_PAYLOAD_SERVER", "route-entry")
    for (const key of ["vix", "vxn", "fearGreed", "putCall", "bofa", "move", "skew", "highYield", "gsBullBear"]) {
      if (key in savePayload) {
        console.log("[panic/update]", key, savePayload[key], typeof savePayload[key])
      }
    }
    const result = await persistPanicPayload(savePayload, { source: "manual", requireHistory: true })
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
  } catch (error) {
    console.error("panic save error", error)
    const message = error instanceof Error ? error.message : String(error ?? "update_failed")
    const stack = error instanceof Error ? error.stack : undefined
    const stage = error && typeof error === "object" && "stage" in error ? error.stage : "pipeline"
    res.status(500).json({
      ok: false,
      message,
      error: message,
      stack,
      payload: savePayload,
      stage,
    })
  }
}
