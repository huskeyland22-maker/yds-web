import {
  fetchPanicMetricsRows,
  panicObjectFromRows,
  rowsFromPanicSnapshot,
  upsertPanicMetricsRows,
} from "./panicMetricsHub.js"
import { upsertPanicIndexHistoryBatch, upsertPanicIndexHistoryFromPayload } from "./panicIndexHistory.js"
import { collectPanicMetricsLive } from "./panicCollectors.js"
import { normalizePanicPayload, panicObjectFromSnapshot } from "./panicSnapshot.js"
import { persistDeskMarketReport } from "./panicMarketReport.js"

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
  const tradeDate = body?.tradeDate || body?.historyDate
  const requireHistory = opts.requireHistory ?? source === "manual"
  const snap = normalizePanicPayload(
    { ...body, updatedAt: body.updatedAt || (tradeDate ? `${String(tradeDate).slice(0, 10)}T12:00:00.000Z` : new Date().toISOString()) },
    { tradeDate, source },
  )

  let history = await upsertPanicIndexHistoryFromPayload(snap, { source, tradeDate: snap.tradeDate })
  if (Array.isArray(body.historyRows) && body.historyRows.length > 0) {
    const batch = await upsertPanicIndexHistoryBatch(body.historyRows, { source })
    history = { ...history, batch }
  }
  if (requireHistory && !history.ok) {
    const detail = history.skipped ? history.reason : history.error
    throw new Error(`panic_index_history_upsert_failed:${detail || "unknown"}`)
  }

  const rows = rowsFromPanicSnapshot(snap)
  await upsertPanicMetricsRows(rows)

  const fresh = await fetchPanicMetricsRows()
  const fromDb = panicObjectFromRows(fresh)
  const data = panicObjectFromSnapshot(snap)
  data.riskRegime = fromDb.riskRegime ?? data.riskRegime
  const meta = computePanicServeMeta(fresh, data)

  let reportResult = { ok: false }
  try {
    reportResult = await persistDeskMarketReport(data, snap.tradeDate)
  } catch (err) {
    reportResult = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }

  return {
    data,
    history,
    meta,
    rowCount: fresh?.length ?? 0,
    tradeDate: snap.tradeDate,
    report: reportResult.ok ? reportResult.report : null,
    reportKey: reportResult.reportKey ?? null,
    reportError: reportResult.ok ? null : reportResult.error || reportResult.reason,
  }
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
