import { metricValueForDb } from "./panicNumeric.js"

/** @typedef {{ key: string, label: string, aliases: string[] }} PanicRequiredSpec */

/**
 * Panic Index 핵심 3지표 (저장·history upsert 완성 조건)
 * BofA / HY는 보조·주간 — optional
 * @type {PanicRequiredSpec[]}
 */
export const PANIC_CORE_METRIC_SPECS = [
  { key: "vix", label: "VIX", aliases: ["vix", "VIX"] },
  {
    key: "fearGreed",
    label: "CNN Fear & Greed",
    aliases: ["fearGreed", "fear_greed", "cnn_fg", "CNN"],
  },
  {
    key: "putCall",
    label: "Put/Call Ratio",
    aliases: ["putCall", "put_call", "PC"],
  },
]

/** @type {PanicRequiredSpec[]} */
export const PANIC_SAVE_REQUIRED_SPECS = [
  { key: "tradeDate", label: "date", aliases: ["tradeDate", "historyDate", "date"] },
  ...PANIC_CORE_METRIC_SPECS,
]

/** @type {PanicRequiredSpec[]} */
export const PANIC_SAVE_OPTIONAL_SPECS = [
  { key: "bofa", label: "BofA Bull & Bear", aliases: ["bofa", "BofA"] },
  {
    key: "highYield",
    label: "HY",
    aliases: ["highYield", "hy_oas", "hyOas", "HY", "high_yield"],
  },
  { key: "vxn", label: "VXN", aliases: ["vxn", "VXN"] },
  { key: "move", label: "MOVE", aliases: ["move", "MOVE"] },
  { key: "skew", label: "SKEW", aliases: ["skew", "SKEW"] },
]

const PANIC_SAVE_COERCE_SPECS = [
  ...PANIC_SAVE_REQUIRED_SPECS,
  ...PANIC_SAVE_OPTIONAL_SPECS,
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

  for (const spec of PANIC_SAVE_COERCE_SPECS) {
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
 */
export function validateCorePanicMetrics(body) {
  const data = coercePanicSavePayload(body)
  const missing = []
  for (const spec of PANIC_CORE_METRIC_SPECS) {
    if (metricValueForDb(data[spec.key]) == null) missing.push(spec.label)
  }
  if (missing.length) {
    return {
      ok: false,
      code: "INCOMPLETE_CORE_METRICS",
      missing,
      message:
        "핵심 Panic Index 3개(VIX · CNN Fear & Greed · Put/Call)가 모두 입력되어야 저장할 수 있습니다.",
    }
  }
  return { ok: true, code: null, missing: [] }
}

/**
 * @param {Record<string, unknown>} body
 * @returns {{ ok: boolean, missing: string[], error?: string, code?: string, message?: string }}
 */
export function validatePanicSavePayload(body) {
  const missing = []
  const data = coercePanicSavePayload(body)

  if (!data.tradeDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(data.tradeDate))) {
    missing.push("date")
  }

  const core = validateCorePanicMetrics(data)
  for (const label of core.missing) {
    if (!missing.includes(label)) missing.push(label)
  }

  if (missing.length) {
    const isCoreOnly = missing.every((m) => m !== "date")
    return {
      ok: false,
      missing,
      code: isCoreOnly ? "INCOMPLETE_CORE_METRICS" : "missing_required",
      error: `missing_required: ${missing.join(", ")}`,
      message: isCoreOnly
        ? "핵심 Panic Index 3개(VIX · CNN Fear & Greed · Put/Call)가 모두 입력되어야 저장할 수 있습니다."
        : `missing_required: ${missing.join(", ")}`,
    }
  }
  return { ok: true, missing: [] }
}
