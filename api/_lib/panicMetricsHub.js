import { supabaseRest } from "./supabaseRest.js"
import {
  assertPanicMetricRowsNumeric,
  finalizePanicMetricRows,
  logPanicInsertPayloadTable,
  toDbDouble,
} from "./panicNumeric.js"
import { PANIC_METRIC_KEYS, panicObjectFromSnapshot, toPanicNum } from "./panicSnapshot.js"

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
  const shouldLog = source === "manual" || source === "api"
  for (const key of METRIC_KEYS) {
    if (!forceAllKeys && !Object.prototype.hasOwnProperty.call(body, key)) continue
    const raw = body[key]
    const metricValue = toPanicNum(raw)
    o[key] = metricValue
    if (shouldLog) {
      console.log("[panic_metrics] build", key, raw, typeof raw, "->", metricValue, typeof metricValue)
    }
    rows.push({
      metric_key: key,
      metric_value: metricValue,
      change_percent: toDbDouble(body?.changes?.[key]),
      status: null,
      market: "global",
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
    market: "global",
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

function isSchemaColumnError(err) {
  const msg = err instanceof Error ? err.message : String(err || "")
  return /column|schema|does not exist|42703|PGRST204/i.test(msg)
}

/** Fixed numeric probe — isolates DB trigger/RPC vs app payload issues. */
export async function probePanicMetricsNumericInsert() {
  const row = {
    metric_key: "__probe_numeric__",
    metric_value: 17.82,
    change_percent: null,
    status: null,
    market: "global",
    source: "probe",
    updated_at: new Date().toISOString(),
  }
  console.log("PROBE_INSERT_START", row.metric_value, typeof row.metric_value)
  logPanicInsertPayloadTable([row], "PROBE_INSERT_PAYLOAD")
  await supabaseRest("panic_metrics?on_conflict=metric_key", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: [row],
  })
  console.log("PROBE_INSERT_SUCCESS")
  return { ok: true, metric_key: row.metric_key, metric_value: row.metric_value }
}

export async function upsertPanicMetricsRows(rows, opts = {}) {
  const safe = finalizePanicMetricRows(rows, {
    log: Boolean(opts.log),
    source: opts.source ?? "upsert",
  })
  assertPanicMetricRowsNumeric(safe)
  console.log("SAVE_PAYLOAD_SERVER")
  logPanicInsertPayloadTable(safe, "SAVE_PAYLOAD_SERVER")
  try {
    return await supabaseRest("panic_metrics?on_conflict=metric_key", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: safe,
    })
  } catch (err) {
    if (!isSchemaColumnError(err)) throw err
    const stripped = safe.map(({ market: _m, ...rest }) => rest)
    return await supabaseRest("panic_metrics?on_conflict=metric_key", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: stripped,
    })
  }
}
