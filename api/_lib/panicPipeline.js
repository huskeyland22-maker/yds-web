import {
  fetchPanicMetricsRows,
  panicObjectFromRows,
  rowsFromPanicPayload,
  upsertPanicMetricsRows,
} from "./panicMetricsHub.js"
import { upsertPanicIndexHistoryFromPayload } from "./panicIndexHistory.js"
import { collectPanicMetricsLive } from "./panicCollectors.js"

const STALE_AFTER_MS = Number(process.env.PANIC_STALE_AFTER_MS) || 6 * 60 * 60 * 1000

function preserveFromExistingRows(rows) {
  const data = panicObjectFromRows(rows)
  const out = {}
  for (const k of ["bofa", "gsBullBear", "vxn", "skew"]) {
    if (data[k] != null) out[k] = data[k]
  }
  return out
}

export function computePanicServeMeta(rows, data) {
  const times = (Array.isArray(rows) ? rows : [])
    .map((r) => Date.parse(String(r.updated_at || "")))
    .filter((n) => Number.isFinite(n))
  const maxTs = times.length ? Math.max(...times) : null
  const updatedAt = data?.updatedAt || (maxTs ? new Date(maxTs).toISOString() : null)
  const ageMs = updatedAt ? Math.max(0, Date.now() - Date.parse(updatedAt)) : null
  const sources = [...new Set((rows || []).map((r) => r.source).filter(Boolean))]
  return {
    updatedAt,
    ageMs,
    isStale: ageMs != null ? ageMs > STALE_AFTER_MS : true,
    rowCount: Array.isArray(rows) ? rows.length : 0,
    sources,
    staleAfterMs: STALE_AFTER_MS,
  }
}

/**
 * @param {Record<string, unknown>} body
 * @param {{ source?: string }} [opts]
 */
export async function persistPanicPayload(body, opts = {}) {
  const source = opts.source || "api"
  const incoming = { ...body, updatedAt: body.updatedAt || new Date().toISOString() }
  const rows = rowsFromPanicPayload(incoming, { source })
  await upsertPanicMetricsRows(rows)
  let history = { ok: false, skipped: true }
  try {
    history = await upsertPanicIndexHistoryFromPayload(incoming, { source })
  } catch (historyErr) {
    history = {
      ok: false,
      error: historyErr instanceof Error ? historyErr.message : "history_failed",
    }
  }
  const fresh = await fetchPanicMetricsRows()
  const data = panicObjectFromRows(fresh)
  const meta = computePanicServeMeta(fresh, data)
  return { data, history, meta, rowCount: fresh?.length ?? 0 }
}

/** Cron / 수집기: 외부 소스 fetch → DB upsert */
export async function runPanicCollectJob() {
  const existing = await fetchPanicMetricsRows()
  const preserve = preserveFromExistingRows(existing)
  const { payload, errors, fetchedCount, partial } = await collectPanicMetricsLive({ preserve })
  const result = await persistPanicPayload(payload, { source: "cron" })
  return {
    ok: true,
    collectedAt: new Date().toISOString(),
    fetchedCount,
    partial,
    collectorErrors: errors,
    ...result,
  }
}
