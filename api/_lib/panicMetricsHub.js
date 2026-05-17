import { supabaseRest } from "./supabaseRest.js"
import { PANIC_METRIC_KEYS, panicObjectFromSnapshot } from "./panicSnapshot.js"

const METRIC_KEYS = PANIC_METRIC_KEYS

function deriveRiskRegime(row) {
  const vix = Number(row?.vix)
  const fg = Number(row?.fearGreed)
  if (!Number.isFinite(vix) || !Number.isFinite(fg)) return "neutral"
  if (fg <= 35 || vix >= 26) return "risk-off"
  if (fg >= 72 && vix < 18) return "risk-on"
  return "neutral"
}

export function panicObjectFromRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    const out = Object.fromEntries(METRIC_KEYS.map((k) => [k, null]))
    out.riskRegime = "neutral"
    out.updatedAt = new Date().toISOString()
    out.accessTier = "pro"
    return out
  }
  const byKey = Object.fromEntries(rows.map((r) => [String(r.metric_key || ""), r]))
  const out = {}
  for (const k of METRIC_KEYS) {
    const cell = byKey[k]
    const v = cell?.metric_value
    out[k] = v === null || v === undefined ? null : Number(v)
    if (typeof out[k] === "number" && !Number.isFinite(out[k])) out[k] = null
  }
  const meta = byKey.risk_regime
  out.riskRegime = typeof meta?.status === "string" && meta.status ? meta.status : deriveRiskRegime(out)
  const times = rows.map((r) => Date.parse(String(r.updated_at || ""))).filter((n) => Number.isFinite(n))
  const maxTs = times.length ? Math.max(...times) : Date.now()
  out.updatedAt = new Date(maxTs).toISOString()
  out.accessTier = "pro"
  return out
}

export function rowsFromPanicPayload(body, opts = {}) {
  const updatedAt =
    typeof body?.updatedAt === "string" && body.updatedAt
      ? body.updatedAt
      : new Date().toISOString()
  const source = typeof opts.source === "string" && opts.source ? opts.source : "api"
  const forceAllKeys = Boolean(opts.forceAllKeys) || source === "manual"
  const rows = []
  const o = {}
  for (const key of METRIC_KEYS) {
    if (!forceAllKeys && !Object.prototype.hasOwnProperty.call(body, key)) continue
    const raw = body[key]
    const n = raw === null || raw === undefined || raw === "" ? null : Number(raw)
    const metricValue = n !== null && Number.isFinite(n) ? n : null
    o[key] = metricValue
    rows.push({
      metric_key: key,
      metric_value: metricValue,
      change_percent:
        body?.changes && body.changes[key] !== undefined && body.changes[key] !== null
          ? Number(body.changes[key])
          : null,
      status: null,
      source,
      updated_at: updatedAt,
    })
  }
  const regime = deriveRiskRegime(o)
  rows.push({
    metric_key: "risk_regime",
    metric_value: null,
    change_percent: null,
    status: regime,
    source,
    updated_at: updatedAt,
  })
  return rows
}

/** @param {ReturnType<import("./panicSnapshot.js").normalizePanicPayload>} snap */
export function rowsFromPanicSnapshot(snap) {
  return rowsFromPanicPayload(
    { ...snap, updatedAt: snap.updatedAt },
    { source: snap.source, forceAllKeys: true },
  )
}

export { panicObjectFromSnapshot }

export async function fetchPanicMetricsRows() {
  return supabaseRest("panic_metrics?select=*", { method: "GET" })
}

export async function upsertPanicMetricsRows(rows) {
  return supabaseRest("panic_metrics?on_conflict=metric_key", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: rows,
  })
}
