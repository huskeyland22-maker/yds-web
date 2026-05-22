import { metricValueForDb } from "./panicNumeric.js"

/** @typedef {{ key: string, label: string, aliases: string[] }} PanicRequiredSpec */

/** @type {PanicRequiredSpec[]} */
export const PANIC_SAVE_REQUIRED_SPECS = [
  { key: "tradeDate", label: "date", aliases: ["tradeDate", "historyDate", "date"] },
  { key: "vix", label: "VIX", aliases: ["vix", "VIX"] },
  { key: "vxn", label: "VXN", aliases: ["vxn", "VXN"] },
  { key: "putCall", label: "PC", aliases: ["putCall", "put_call", "PC"] },
  { key: "fearGreed", label: "CNN", aliases: ["fearGreed", "fear_greed", "cnn_fg", "CNN"] },
  { key: "move", label: "MOVE", aliases: ["move", "MOVE"] },
  { key: "bofa", label: "BofA", aliases: ["bofa", "BofA"] },
  { key: "skew", label: "SKEW", aliases: ["skew", "SKEW"] },
  { key: "highYield", label: "HY", aliases: ["highYield", "hy_oas", "hyOas", "HY"] },
  { key: "gsBullBear", label: "GS", aliases: ["gsBullBear", "gs_bb", "gs", "GS"] },
]

/** @param {Record<string, unknown>} obj */
export function stripNilEntries(obj) {
  if (!obj || typeof obj !== "object") return obj
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null),
  )
}

/** @deprecated use stripNilEntries */
export const stripUndefinedEntries = stripNilEntries

/** @param {Record<string, unknown>} body @param {string[]} aliases */
function pickRaw(body, aliases) {
  for (const k of aliases) {
    const v = body[k]
    if (v !== undefined && v !== null && v !== "") return v
  }
  return undefined
}

/**
 * VIX·VXN·PC·CNN·MOVE·BofA·SKEW·HY·GS — Number() 강제 (%·쉼표 제거)
 * @param {Record<string, unknown>} body
 */
export function coercePanicSavePayload(body) {
  const data = body && typeof body === "object" ? body : {}
  const dateRaw = pickRaw(data, ["tradeDate", "historyDate", "date"])
  const tradeDate =
    typeof dateRaw === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateRaw)
      ? dateRaw.slice(0, 10)
      : undefined

  const out = {
    ...stripNilEntries(data),
    accessTier: data.accessTier ?? "pro",
  }
  if (tradeDate) out.tradeDate = tradeDate

  for (const spec of PANIC_SAVE_REQUIRED_SPECS) {
    if (spec.key === "tradeDate") continue
    const raw = pickRaw(data, spec.aliases)
    const num = metricValueForDb(raw)
    if (num != null) out[spec.key] = num
    else delete out[spec.key]
  }

  if (data.updatedAt != null && data.updatedAt !== "") {
    out.updatedAt = data.updatedAt
  } else if (tradeDate) {
    out.updatedAt = `${tradeDate}T12:00:00.000Z`
  }

  return stripNilEntries(out)
}

/**
 * @param {Record<string, unknown>} body
 * @returns {{ ok: boolean, missing: string[], error?: string }}
 */
export function validatePanicSavePayload(body) {
  const missing = []
  const data = coercePanicSavePayload(body)

  if (!data.tradeDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(data.tradeDate))) {
    missing.push("date")
  }

  for (const spec of PANIC_SAVE_REQUIRED_SPECS) {
    if (spec.key === "tradeDate") continue
    if (metricValueForDb(data[spec.key]) == null) missing.push(spec.label)
  }

  if (missing.length) {
    return {
      ok: false,
      missing,
      error: `missing_required: ${missing.join(", ")}`,
    }
  }
  return { ok: true, missing: [] }
}
