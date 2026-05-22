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
export function stripUndefinedEntries(obj) {
  if (!obj || typeof obj !== "object") return obj
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

/** @param {Record<string, unknown>} body @param {string[]} aliases */
function pickRaw(body, aliases) {
  for (const k of aliases) {
    const v = body[k]
    if (v !== undefined && v !== null && v !== "") return v
  }
  return undefined
}

/**
 * @param {Record<string, unknown>} body
 * @returns {{ ok: boolean, missing: string[], error?: string }}
 */
export function validatePanicSavePayload(body) {
  const missing = []
  const data = body && typeof body === "object" ? body : {}

  const dateRaw = pickRaw(data, ["tradeDate", "historyDate", "date"])
  const dateStr =
    typeof dateRaw === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateRaw)
      ? dateRaw.slice(0, 10)
      : null
  if (!dateStr) missing.push("date")

  for (const spec of PANIC_SAVE_REQUIRED_SPECS) {
    if (spec.key === "tradeDate") continue
    const raw = pickRaw(data, spec.aliases)
    if (metricValueForDb(raw) == null) missing.push(spec.label)
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
