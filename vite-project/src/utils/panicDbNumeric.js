/** Client-side mirror of api/_lib/panicNumeric.js — coerce before POST /api/panic/update */

export function metricValueForDb(value) {
  if (value == null || value === "") return null
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  const n = Number(
    String(value)
      .replace(/%/g, "")
      .replace(/,/g, "")
      .trim(),
  )
  return Number.isFinite(n) ? n : null
}

export const PANIC_SUBMIT_NUMERIC_KEYS = [
  "vix",
  "vxn",
  "fearGreed",
  "putCall",
  "bofa",
  "move",
  "skew",
  "highYield",
  "gsBullBear",
]

/** @param {Record<string, unknown>} data */
export function normalizePanicSubmitPayload(data) {
  if (!data || typeof data !== "object") return data
  const out = {
    ...data,
    accessTier: "pro",
    updatedAt: data.updatedAt ?? new Date().toISOString().slice(0, 16).replace("T", " "),
  }
  for (const key of PANIC_SUBMIT_NUMERIC_KEYS) {
    const alt =
      key === "fearGreed"
        ? data.fear_greed ?? data.cnn_fg
        : key === "putCall"
          ? data.put_call
          : key === "highYield"
            ? data.hy_oas
            : key === "gsBullBear"
              ? data.gs_bb
              : key === "bofa"
                ? data.bofa_bb
                : undefined
    const raw = data[key] ?? alt
    const num = metricValueForDb(raw)
    out[key] = num
    console.log("[panic submit]", key, raw, typeof raw, "->", num, typeof num)
  }
  if (data.gs != null && out.gsBullBear == null) out.gsBullBear = metricValueForDb(data.gs)
  return out
}

/** @param {Record<string, unknown>} payload */
export function assertPanicSubmitPayloadNumeric(payload) {
  for (const key of PANIC_SUBMIT_NUMERIC_KEYS) {
    if (!(key in payload)) continue
    const v = payload[key]
    if (v !== null && typeof v !== "number") {
      throw new Error(`panic submit ${key} not number: ${String(v)} type=${typeof v}`)
    }
  }
}
