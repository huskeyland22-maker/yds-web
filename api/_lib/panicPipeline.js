import {
  fetchPanicMetricsRows,
  panicObjectFromRows,
  probePanicMetricsNumericInsert,
  rowsFromPanicSnapshot,
  shouldRefreshLatestPanicSnapshot,
  upsertPanicMetricsRows,
} from "./panicMetricsHub.js"
import {
  fetchPanicHistoryRowBefore,
  fetchPanicIndexHistoryRows,
  upsertPanicIndexHistoryBatch,
  upsertPanicIndexHistoryFromPayload,
} from "./panicIndexHistory.js"
import { syncLatestPanicMetricsRpc } from "./latestPanicMetrics.js"
import {
  fetchMarketCycleRowByDate,
  upsertMarketCycleHistoryFromSnapshot,
} from "./marketCycleHistory.js"
import { collectPanicMetricsLive, MANUAL_PANIC_CORE_KEYS, omitManualPanicCore } from "./panicCollectors.js"
import { logPanicPipelineStage } from "./panicNumeric.js"
import { upsertPanicHistoryV2ForSnapshot } from "./panicHistoryV2Db.js"
import { normalizePanicPayload, panicObjectFromSnapshot } from "./panicSnapshot.js"

const STALE_AFTER_MS = Number(process.env.PANIC_STALE_AFTER_MS) || 6 * 60 * 60 * 1000

export async function readLatestPanicHistoryDate() {
  try {
    const rows = await fetchPanicIndexHistoryRows({ limit: 1 })
    const row = rows.length ? rows[rows.length - 1] : null
    const date = String(row?.date ?? "").slice(0, 10)
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null
  } catch (err) {
    console.warn("[panic] latest history date unread", err instanceof Error ? err.message : err)
    return null
  }
}

export function preserveFromExistingRows(rows) {
  const data = panicObjectFromRows(rows)
  const out = {}
  for (const k of ["bofa", "vxn", "skew"]) {
    if (data[k] != null) out[k] = data[k]
  }
  for (const key of MANUAL_PANIC_CORE_KEYS) delete out[key]
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
  logPanicPipelineStage("1-incoming", body)
  if (source === "manual") {
    try {
      const probe = await probePanicMetricsNumericInsert()
      console.log("PROBE_INSERT_OK", probe)
    } catch (probeErr) {
      const msg = probeErr instanceof Error ? probeErr.message : String(probeErr)
      console.error("PROBE_INSERT_FAILED", msg)
    }
  }
  const snap = normalizePanicPayload(
    { ...body, updatedAt: body.updatedAt || (tradeDate ? `${String(tradeDate).slice(0, 10)}T12:00:00.000Z` : new Date().toISOString()) },
    { tradeDate, source },
  )
  logPanicPipelineStage("2-snapshot", snap)

  let history = await upsertPanicIndexHistoryFromPayload(snap, { source, tradeDate: snap.tradeDate })
  if (Array.isArray(body.historyRows) && body.historyRows.length > 0) {
    const batch = await upsertPanicIndexHistoryBatch(body.historyRows, { source })
    history = { ...history, batch }
  }
  if (requireHistory && !history.ok) {
    const detail = history.skipped ? history.reason : history.error
    const isIncomplete =
      detail === "incomplete_core_metrics" || history.code === "INCOMPLETE_CORE_METRICS"
    if (isIncomplete) {
      const err = new Error(
        history.message ||
          "핵심 Panic Index 3개(VIX · CNN Fear & Greed · Put/Call)가 모두 입력되어야 저장할 수 있습니다.",
      )
      err.stage = "validation"
      err.statusCode = 400
      err.code = "INCOMPLETE_CORE_METRICS"
      err.missing = history.missing ?? []
      err.history = history
      throw err
    }
    const err = new Error(`panic_index_history_upsert_failed:${detail || "unknown"}`)
    err.stage = "history"
    throw err
  }

  let panicHistoryV2 = { ok: false }
  const latestHistoryDate = await readLatestPanicHistoryDate()
  const refreshLatest = shouldRefreshLatestPanicSnapshot(snap.tradeDate, latestHistoryDate)
  const pastManual = source === "manual" && !refreshLatest
  if (pastManual) {
    panicHistoryV2 = { ok: false, skipped: true, reason: "past_manual_history_only" }
  } else {
    try {
      panicHistoryV2 = await upsertPanicHistoryV2ForSnapshot(snap, { source })
      if (!panicHistoryV2.ok && !panicHistoryV2.skipped) {
        console.warn("[panic] panic_history_v2 save failed", panicHistoryV2)
      } else if (panicHistoryV2.ok) {
        console.log("[panic] panic_history_v2 saved", panicHistoryV2.date, panicHistoryV2.panic_v2)
      }
    } catch (err) {
      panicHistoryV2 = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
      console.warn("[panic] panic_history_v2 save error", panicHistoryV2.error)
    }
  }

  let cycleHistory = { ok: false }
  const cronWithoutManualCore = source === "cron" && [snap.vix, snap.fearGreed, snap.putCall].some((v) => v == null)
  try {
    if (pastManual) {
      cycleHistory = { ok: false, skipped: true, reason: "past_manual_history_only" }
    } else if (cronWithoutManualCore) {
      cycleHistory = { ok: false, skipped: true, reason: "manual_core_not_in_cron" }
    } else {
      const previous = await fetchPanicHistoryRowBefore(snap.tradeDate)
      cycleHistory = await upsertMarketCycleHistoryFromSnapshot(snap, previous, { source })
      await syncLatestPanicMetricsRpc(snap.tradeDate)
    }
  } catch (err) {
    cycleHistory = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
    console.warn("[panic] post-history sync failed", cycleHistory.error)
  }

  let metricsError = null
  if (pastManual) {
    metricsError = null
  } else {
    const rows = rowsFromPanicSnapshot(snap)
    console.log("[panic pipeline] 3-metric-rows", rows.length)
    for (const r of rows) {
      console.log(
        "[panic pipeline] 3-row",
        r.metric_key,
        r.metric_value,
        typeof r.metric_value,
      )
    }
    try {
      await upsertPanicMetricsRows(rows, { log: source === "manual", source })
    } catch (err) {
      metricsError = err instanceof Error ? err.message : String(err)
      console.error("[panic] panic_metrics upsert failed", metricsError)
      if (source === "manual") {
        const e = new Error(metricsError)
        e.stage = "panic_metrics"
        throw e
      }
    }
  }

  let fresh = []
  try {
    fresh = await fetchPanicMetricsRows()
  } catch (err) {
    metricsError = metricsError || (err instanceof Error ? err.message : String(err))
  }
  const fromDb = fresh?.length ? panicObjectFromRows(fresh) : null
  const data = panicObjectFromSnapshot(snap)
  if (fromDb) data.riskRegime = fromDb.riskRegime ?? data.riskRegime
  const meta = computePanicServeMeta(fresh, data)

  let dailyReportResult = { ok: false }
  if (!pastManual) {
    try {
      const cycleRow = cycleHistory?.ok ? await fetchMarketCycleRowByDate(snap.tradeDate) : null
      const { createAndPersistDailyReport } = await import("./dailyAiReports.js")
      dailyReportResult = await createAndPersistDailyReport(data, snap.tradeDate, {
        source,
        cycleRow,
      })
    } catch (err) {
      dailyReportResult = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
      console.warn("[panic] daily report failed", dailyReportResult.error)
    }
  }

  return {
    data,
    history,
    panicHistoryV2,
    cycleHistory,
    meta,
    rowCount: fresh?.length ?? 0,
    tradeDate: snap.tradeDate,
    latestHistoryDate,
    latestSnapshotUpdated: !pastManual && refreshLatest,
    metricsError,
    report: dailyReportResult.ok ? dailyReportResult.report : null,
    dailyReport: dailyReportResult.ok ? dailyReportResult.daily : null,
    sectorScores: dailyReportResult.ok ? dailyReportResult.sectors : null,
    reportError: dailyReportResult.ok ? null : dailyReportResult.error || dailyReportResult.reason,
  }
}

/** Cron / 수집기: 외부 소스 fetch → DB upsert */
export async function runPanicCollectJob() {
  const existing = await fetchPanicMetricsRows()
  const preserve = preserveFromExistingRows(existing)
  const collected = await collectPanicMetricsLive({ preserve })
  const payload = omitManualPanicCore(collected.payload)
  const { errors, fetchedCount, partial } = collected
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
