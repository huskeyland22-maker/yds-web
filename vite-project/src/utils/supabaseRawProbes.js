import { createClient } from "@supabase/supabase-js"
import { fetchPanicHubLatest, isPanicHubEnabled } from "../config/api.js"
import { getSupabaseEnv } from "../lib/supabaseBrowser.js"
import {
  classifyDataFailure,
  debugError,
  debugLog,
  debugWarn,
  summarizeRows,
  withTimeout,
} from "./supabaseDebugProbe.js"

export const RAW_QUERY_TIMEOUT_MS = 20_000

/** @typedef {'SUCCESS' | 'EMPTY' | 'ERROR' | 'LOADING' | 'IDLE'} RawProbeStatus */

/**
 * @typedef {object} RawProbeResult
 * @property {string} id
 * @property {string} tableName
 * @property {string} queryChain
 * @property {RawProbeStatus} status
 * @property {number | null} responseTimeMs
 * @property {number} rowCount
 * @property {unknown[] | null} fetchedRows
 * @property {string | null} latestUpdatedAt
 * @property {object | null} queryError
 * @property {string | null} errorMessage
 * @property {string | null} errorCode
 * @property {string | null} classification
 * @property {string | null} classificationHint
 * @property {string} rawJson
 */

export const SUPABASE_RAW_TABLE_PROBES = [
  {
    id: "panic_metrics",
    tableName: "panic_metrics",
    queryChain: "from('panic_metrics').select('*').order('updated_at', { ascending: false }).limit(5)",
    table: "panic_metrics",
    order: { column: "updated_at", ascending: false },
  },
  {
    id: "panic_index_history",
    tableName: "panic_index_history",
    queryChain:
      "from('panic_index_history').select('*').order('date', { ascending: false }).limit(5)",
    table: "panic_index_history",
    order: { column: "date", ascending: false },
  },
  {
    id: "market_status",
    tableName: "market_status",
    queryChain: "from('market_status').select('*').order('updated_at', { ascending: false }).limit(5)",
    table: "market_status",
    order: { column: "updated_at", ascending: false },
  },
  {
    id: "ai_reports",
    tableName: "ai_reports",
    queryChain: "from('ai_reports').select('*').order('updated_at', { ascending: false }).limit(5)",
    table: "ai_reports",
    order: { column: "updated_at", ascending: false },
  },
]

export function isSupabaseRawDebugVisible() {
  if (import.meta.env.VITE_SUPABASE_RAW_DEBUG === "1" || import.meta.env.VITE_SUPABASE_RAW_DEBUG === "true") {
    return true
  }
  if (typeof window === "undefined") return false
  try {
    if (new URLSearchParams(window.location.search).get("supabase-debug") === "1") return true
    if (window.localStorage?.getItem("yds-supabase-raw-debug") === "1") return true
  } catch {
    // ignore
  }
  return false
}

/** 패닉 데이터 비어 있을 때 자동 표시 (추측 디버그용) */
export function shouldAutoShowSupabaseRawDebug(panicInitialized, panicData) {
  if (isSupabaseRawDebugVisible()) return true
  if (!panicInitialized) return false
  if (panicData) return false
  return isPanicHubEnabled()
}

/**
 * @param {unknown[]} rows
 * @param {unknown} error
 * @returns {RawProbeStatus}
 */
export function deriveRawStatus(rows, error) {
  if (error) return "ERROR"
  const n = Array.isArray(rows) ? rows.length : 0
  if (n === 0) return "EMPTY"
  return "SUCCESS"
}

function serializeError(error) {
  if (!error) return null
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack }
  }
  if (typeof error === "object") {
    return {
      message: error.message ?? null,
      code: error.code ?? null,
      details: error.details ?? null,
      hint: error.hint ?? null,
      status: error.status ?? null,
    }
  }
  return { message: String(error) }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {typeof SUPABASE_RAW_TABLE_PROBES[0]} spec
 * @returns {Promise<RawProbeResult>}
 */
export async function runRawTableProbe(client, spec) {
  const started = performance.now()
  debugLog("raw-query:start", { table: spec.tableName, query: spec.queryChain })

  let q = client.from(spec.table).select("*").limit(5)
  if (spec.order?.column) {
    q = q.order(spec.order.column, { ascending: Boolean(spec.order.ascending) })
  }

  try {
    const { data, error, status, statusText } = await withTimeout(q, RAW_QUERY_TIMEOUT_MS, spec.table)
    const responseTimeMs = Math.round(performance.now() - started)

    if (error) {
      const failure = classifyDataFailure(error, { rowCount: 0 })
      debugError("raw-query:fail", { table: spec.tableName, ...serializeError(error), responseTimeMs })
      return {
        id: spec.id,
        tableName: spec.tableName,
        queryChain: spec.queryChain,
        status: "ERROR",
        responseTimeMs,
        rowCount: 0,
        fetchedRows: null,
        latestUpdatedAt: null,
        queryError: serializeError(error),
        errorMessage: error.message ?? failure.message,
        errorCode: error.code ?? failure.code,
        classification: failure.code,
        classificationHint: failure.hint,
        rawJson: JSON.stringify({ data: null, error, status, statusText }, null, 2),
      }
    }

    const fetchedRows = Array.isArray(data) ? data : []
    const summary = summarizeRows(fetchedRows)
    const statusLabel = deriveRawStatus(fetchedRows, null)
    if (statusLabel === "EMPTY") debugWarn("raw-query:empty", { table: spec.tableName })
    else debugLog("raw-query:success", { table: spec.tableName, rowCount: summary.rowCount, responseTimeMs })

    const failure = statusLabel === "EMPTY" ? classifyDataFailure(null, { rowCount: 0 }) : null

    return {
      id: spec.id,
      tableName: spec.tableName,
      queryChain: spec.queryChain,
      status: statusLabel,
      responseTimeMs,
      rowCount: summary.rowCount,
      fetchedRows,
      latestUpdatedAt: summary.latestUpdatedAt,
      queryError: null,
      errorMessage: failure?.message ?? null,
      errorCode: failure?.code ?? null,
      classification: failure?.code ?? null,
      classificationHint: failure?.hint ?? null,
      rawJson: JSON.stringify(fetchedRows, null, 2),
    }
  } catch (e) {
    const responseTimeMs = Math.round(performance.now() - started)
    const failure = classifyDataFailure(e, { rowCount: 0 })
    debugError("raw-query:exception", { table: spec.tableName, message: failure.message, responseTimeMs })
    return {
      id: spec.id,
      tableName: spec.tableName,
      queryChain: spec.queryChain,
      status: "ERROR",
      responseTimeMs,
      rowCount: 0,
      fetchedRows: null,
      latestUpdatedAt: null,
      queryError: serializeError(e),
      errorMessage: failure.message,
      errorCode: failure.code,
      classification: failure.code,
      classificationHint: failure.hint,
      rawJson: JSON.stringify({ exception: String(e instanceof Error ? e.message : e) }, null, 2),
    }
  }
}

/** @returns {Promise<RawProbeResult>} */
export async function runRawHubApiProbe() {
  const queryChain = "fetch('/api/panic/latest') — server: service_role → panic_metrics"
  const tableName = "(hub api)"
  const started = performance.now()
  debugLog("raw-hub:start", { query: queryChain })

  try {
    if (!isPanicHubEnabled()) {
      throw new Error("VITE_PANIC_HUB not enabled")
    }
    const data = await withTimeout(fetchPanicHubLatest({ debugLog: true }), RAW_QUERY_TIMEOUT_MS, "hub-api")
    const responseTimeMs = Math.round(performance.now() - started)
    const fetchedRows = data ? [data] : []
    const statusLabel = deriveRawStatus(fetchedRows, null)
    debugLog("raw-hub:done", { status: statusLabel, responseTimeMs })
    return {
      id: "hub_api",
      tableName,
      queryChain,
      status: statusLabel,
      responseTimeMs,
      rowCount: fetchedRows.length,
      fetchedRows,
      latestUpdatedAt: data?.updatedAt ?? null,
      queryError: null,
      errorMessage: statusLabel === "EMPTY" ? "empty payload" : null,
      errorCode: null,
      classification: statusLabel === "EMPTY" ? "empty_rows" : null,
      classificationHint: null,
      rawJson: JSON.stringify(data ?? null, null, 2),
    }
  } catch (e) {
    const responseTimeMs = Math.round(performance.now() - started)
    const failure = classifyDataFailure(e, { rowCount: 0 })
    debugError("raw-hub:fail", { ...failure, responseTimeMs })
    return {
      id: "hub_api",
      tableName,
      queryChain,
      status: "ERROR",
      responseTimeMs,
      rowCount: 0,
      fetchedRows: null,
      latestUpdatedAt: null,
      queryError: serializeError(e),
      errorMessage: failure.message,
      errorCode: failure.code,
      classification: failure.code,
      classificationHint: failure.hint,
      rawJson: JSON.stringify({ error: serializeError(e) }, null, 2),
    }
  }
}

/** @returns {Promise<RawProbeResult[]>} */
export async function runAllRawSupabaseProbes() {
  const results = []

  results.push(await runRawHubApiProbe())

  const { url, anonKey, configured } = getSupabaseEnv()
  if (!configured) {
    const failure = classifyDataFailure(new Error("VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing"))
    for (const spec of SUPABASE_RAW_TABLE_PROBES) {
      results.push({
        id: spec.id,
        tableName: spec.tableName,
        queryChain: spec.queryChain,
        status: "ERROR",
        responseTimeMs: null,
        rowCount: 0,
        fetchedRows: null,
        latestUpdatedAt: null,
        queryError: { message: failure.message },
        errorMessage: failure.message,
        errorCode: "not_configured",
        classification: failure.code,
        classificationHint: failure.hint,
        rawJson: JSON.stringify({ error: failure }, null, 2),
      })
    }
    return results
  }

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  for (const spec of SUPABASE_RAW_TABLE_PROBES) {
    results.push(await runRawTableProbe(client, spec))
  }

  return results
}
