import {
  classifyPanicCoreFreshness,
  panicCoreMetricsComplete,
  panicObservationDateKey,
  PANIC_MANUAL_ENTRY_GRACE_MS,
} from "./usEquitySession.js"

const STALE_AFTER_MS = Number(process.env.PANIC_STALE_AFTER_MS) || PANIC_MANUAL_ENTRY_GRACE_MS

/**
 * Hub latest meta. Keeps ageMs / staleAfterMs for compatibility.
 * isStale follows US equity session freshness for manual core metrics
 * (not raw 6h wall-clock alone).
 *
 * @param {unknown[]} rows
 * @param {Record<string, unknown> | null | undefined} data
 * @param {{ now?: Date | number | string }} [opts]
 */
export function computePanicServeMeta(rows, data, opts = {}) {
  const times = (Array.isArray(rows) ? rows : [])
    .map((r) => Date.parse(String(r?.updated_at || "")))
    .filter((n) => Number.isFinite(n))
  const maxTs = times.length ? Math.max(...times) : null
  const updatedAt = data?.updatedAt || (maxTs ? new Date(maxTs).toISOString() : null)
  const ageMs = updatedAt ? Math.max(0, Date.now() - Date.parse(String(updatedAt))) : null
  const sources = [...new Set((rows || []).map((r) => r?.source).filter(Boolean))]

  const asOfDate = panicObservationDateKey(data)
  const coreComplete = panicCoreMetricsComplete(data)
  const freshness = classifyPanicCoreFreshness({
    asOfDate,
    coreComplete,
    now: opts.now ?? new Date(),
    graceMs: STALE_AFTER_MS,
  })

  // Compat: waiting/live are not stale; delayed/error remain stale for existing clients.
  const isStale = Boolean(freshness.isStaleCompatible)

  return {
    updatedAt,
    ageMs,
    isStale,
    rowCount: Array.isArray(rows) ? rows.length : 0,
    sources,
    staleAfterMs: STALE_AFTER_MS,
    freshness: {
      status: freshness.status,
      asOfDate: freshness.asOfDate,
      expectedObservationDay: freshness.expectedObservationDay,
      phase: freshness.session.phase,
      nyDate: freshness.session.nyDate,
      graceMs: freshness.session.graceMs,
      earlyCloseModeled: false,
      holidayListBounded: true,
      policy: "us_equity_session_manual_core",
    },
  }
}
