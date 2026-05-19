/**
 * Supabase PostgREST from Vercel Node (no supabase-js dependency in api bundle).
 * Uses service role — never expose to the browser.
 */

import {
  assertPanicHistoryRowNumeric,
  assertPanicMetricRowsNumeric,
  finalizePanicHistoryRow,
  finalizePanicMetricRows,
  logPanicInsertPayloadTable,
} from "./panicNumeric.js"

function getSupabaseConfig() {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "")
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()
  return { url, key }
}

export function isSupabaseConfigured() {
  const { url, key } = getSupabaseConfig()
  return Boolean(url && key)
}

/** Last gate before PostgREST — coerce numeric columns, never send strings. */
function prepareSupabaseBody(pathQuery, body) {
  if (body === undefined || body === null) return body
  const path = String(pathQuery || "")

  if (path.startsWith("panic_metrics")) {
    const rows = finalizePanicMetricRows(Array.isArray(body) ? body : [body], {
      log: true,
      source: "supabaseRest",
    })
    assertPanicMetricRowsNumeric(rows)
    logPanicInsertPayloadTable(rows, "SUPABASE_INSERT_PRE")
    return Array.isArray(body) ? rows : rows[0]
  }

  if (path.startsWith("panic_index_history")) {
    const list = Array.isArray(body) ? body : [body]
    const rows = list.map((row) => finalizePanicHistoryRow(row))
    for (const row of rows) assertPanicHistoryRowNumeric(row)
    console.table(
      rows.map((r) => ({
        date: r.date,
        vix: r.vix,
        vix_type: typeof r.vix,
        put_call: r.put_call,
        put_call_type: typeof r.put_call,
      })),
    )
    return Array.isArray(body) ? rows : rows[0]
  }

  return body
}

/**
 * @param {string} pathQuery e.g. "panic_metrics?select=*"
 * @param {{ method?: string, body?: unknown, prefer?: string }} opts
 */
export async function supabaseRest(pathQuery, opts = {}) {
  const { url, key } = getSupabaseConfig()
  if (!url || !key) throw new Error("Supabase URL or service role key missing")

  const method = opts.method || "GET"
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  }
  if (opts.prefer) headers.Prefer = opts.prefer

  const preparedBody =
    method !== "GET" && method !== "HEAD" && opts.body !== undefined
      ? prepareSupabaseBody(pathQuery, opts.body)
      : opts.body

  const isPanicMetricsWrite =
    String(pathQuery).startsWith("panic_metrics") &&
    method !== "GET" &&
    method !== "HEAD" &&
    preparedBody !== undefined

  if (isPanicMetricsWrite) {
    console.log("INSERT_START", { path: pathQuery, method })
    logPanicInsertPayloadTable(preparedBody, "INSERT_START_PAYLOAD")
  }

  const jsonBody = preparedBody !== undefined ? JSON.stringify(preparedBody) : undefined

  const res = await fetch(`${url}/rest/v1/${pathQuery}`, {
    method,
    headers,
    body: jsonBody,
    cache: "no-store",
  })
  const text = await res.text()
  let json = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = { raw: text }
    }
  }
  if (!res.ok) {
    const msg = typeof json?.message === "string" ? json.message : text || res.statusText
    if (isPanicMetricsWrite) {
      console.error("INSERT_FAILED", { status: res.status, message: msg })
    }
    throw new Error(`Supabase ${res.status}: ${msg}`)
  }
  if (isPanicMetricsWrite) {
    console.log("INSERT_SUCCESS", { path: pathQuery, status: res.status })
  }
  return json
}
