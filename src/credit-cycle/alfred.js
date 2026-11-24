import { normalizeObservation, sortObservations } from "./normalize.js"
import { QUALITY } from "./config.js"

/**
 * @typedef {object} AlfredRevision
 * @property {string} observation_date
 * @property {string} realtime_start
 * @property {string | null} realtime_end
 * @property {number | null} value
 * @property {string} [series_id]
 */

/**
 * Parse FRED/ALFRED observation row (output_type=1 realtime panel).
 * @param {Record<string, unknown>} row
 * @param {string} seriesId
 * @returns {AlfredRevision | null}
 */
export function parseAlfredRevisionRow(row, seriesId) {
  const observation_date = String(row.date ?? row.observation_date ?? "").slice(0, 10)
  const realtime_start = String(row.realtime_start ?? "").slice(0, 10)
  let realtime_end = row.realtime_end != null ? String(row.realtime_end).slice(0, 10) : null
  if (realtime_end === "." || realtime_end === "") realtime_end = null
  // Open-ended current vintage
  if (realtime_end === "9999-12-31") realtime_end = null

  let value = row.value
  if (value === "." || value === "" || value == null) value = null
  else value = Number(value)
  if (!Number.isFinite(value)) value = null

  if (!observation_date || !realtime_start) return null
  return {
    series_id: seriesId,
    observation_date,
    realtime_start,
    realtime_end,
    value,
  }
}

/**
 * Was this revision visible on asOfDate?
 * @param {AlfredRevision} rev
 * @param {string} asOfDate
 */
export function isRevisionVisibleAsOf(rev, asOfDate) {
  if (!rev || !asOfDate) return false
  if (rev.realtime_start > asOfDate) return false
  if (rev.realtime_end && rev.realtime_end < asOfDate) return false
  return true
}

/**
 * Value for a specific observation_date as known on asOfDate.
 * @param {AlfredRevision[]} revisions
 * @param {string} observationDate
 * @param {string} asOfDate
 */
export function selectPitValueForObservation(revisions, observationDate, asOfDate) {
  const candidates = revisions.filter(
    (r) =>
      r.observation_date === observationDate &&
      r.value != null &&
      isRevisionVisibleAsOf(r, asOfDate),
  )
  if (candidates.length < 1) {
    return { value: null, revision: null, status: "NOT_AVAILABLE" }
  }
  // Among visible revisions, pick the one with latest realtime_start (most recent known as of asOf)
  candidates.sort((a, b) => b.realtime_start.localeCompare(a.realtime_start))
  return { value: candidates[0].value, revision: candidates[0], status: "PIT" }
}

/**
 * Initial-release value for an observation (earliest realtime_start).
 * @param {AlfredRevision[]} revisions
 * @param {string} observationDate
 */
export function selectInitialRelease(revisions, observationDate) {
  const candidates = revisions.filter(
    (r) => r.observation_date === observationDate && r.value != null,
  )
  if (candidates.length < 1) {
    return { value: null, revision: null, status: "NOT_AVAILABLE" }
  }
  candidates.sort((a, b) => a.realtime_start.localeCompare(b.realtime_start))
  return { value: candidates[0].value, revision: candidates[0], status: "INITIAL" }
}

/**
 * Latest revised value (max realtime_start, preferring open-ended).
 * @param {AlfredRevision[]} revisions
 * @param {string} observationDate
 */
export function selectLatestRevised(revisions, observationDate) {
  const candidates = revisions.filter(
    (r) => r.observation_date === observationDate && r.value != null,
  )
  if (candidates.length < 1) {
    return { value: null, revision: null, status: "NOT_AVAILABLE" }
  }
  candidates.sort((a, b) => {
    const ae = a.realtime_end == null ? 1 : 0
    const be = b.realtime_end == null ? 1 : 0
    if (ae !== be) return be - ae
    return b.realtime_start.localeCompare(a.realtime_start)
  })
  return { value: candidates[0].value, revision: candidates[0], status: "REVISED" }
}

/**
 * Build expanding PIT observation history usable on asOfDate.
 * Each point uses the value that was published by asOf (not future revisions).
 *
 * @param {AlfredRevision[]} revisions
 * @param {string} asOfDate
 * @param {{ seriesId: string, frequency: string, source?: string }} meta
 */
export function buildPitObservationHistory(revisions, asOfDate, meta) {
  const dates = [
    ...new Set(
      revisions
        .filter((r) => r.value != null && r.realtime_start <= asOfDate)
        .map((r) => r.observation_date),
    ),
  ].sort()

  /** @type {import('./normalize.js').Observation[]} */
  const out = []
  for (const d of dates) {
    const pit = selectPitValueForObservation(revisions, d, asOfDate)
    if (pit.value == null || !pit.revision) continue
    // Observation period ending after asOf should not appear unless already released
    // (already gated by realtime_start <= asOf)
    out.push(
      normalizeObservation({
        series_id: meta.seriesId,
        observation_date: d,
        release_date: pit.revision.realtime_start,
        realtime_start: pit.revision.realtime_start,
        realtime_end: pit.revision.realtime_end,
        value: pit.value,
        frequency: meta.frequency,
        source: meta.source ?? "alfred_pit",
        vintage_available: true,
        quality_status: QUALITY.VALID,
        vintage_status: "PIT",
      }),
    )
  }
  return sortObservations(out)
}

/**
 * Compare initial vs latest revised for overlap dates.
 * @param {AlfredRevision[]} revisions
 */
export function compareInitialVsRevised(revisions) {
  const dates = [...new Set(revisions.map((r) => r.observation_date))].sort()
  /** @type {object[]} */
  const rows = []
  for (const d of dates) {
    const init = selectInitialRelease(revisions, d)
    const latest = selectLatestRevised(revisions, d)
    if (init.value == null || latest.value == null) continue
    const delta = latest.value - init.value
    rows.push({
      observation_date: d,
      initial: init.value,
      initial_realtime_start: init.revision?.realtime_start ?? null,
      revised: latest.value,
      revised_realtime_start: latest.revision?.realtime_start ?? null,
      delta,
      changed: delta !== 0,
    })
  }
  const changed = rows.filter((r) => r.changed)
  return {
    n: rows.length,
    nChanged: changed.length,
    shareChanged: rows.length ? changed.length / rows.length : null,
    maxAbsDelta: changed.length
      ? Math.max(...changed.map((r) => Math.abs(r.delta)))
      : 0,
    samples: changed.slice(-5),
  }
}

/**
 * Earliest vintage / realtime_start across revisions — ALFRED coverage start.
 * @param {AlfredRevision[]} revisions
 */
export function alfredCoverageBounds(revisions) {
  if (!revisions.length) {
    return {
      status: "NOT_AVAILABLE",
      earliestRealtime: null,
      latestRealtime: null,
      earliestObservation: null,
      latestObservation: null,
      nRevisions: 0,
    }
  }
  const rts = revisions.map((r) => r.realtime_start).filter(Boolean).sort()
  const obs = revisions.map((r) => r.observation_date).filter(Boolean).sort()
  return {
    status: "OK",
    earliestRealtime: rts[0] ?? null,
    latestRealtime: rts[rts.length - 1] ?? null,
    earliestObservation: obs[0] ?? null,
    latestObservation: obs[obs.length - 1] ?? null,
    nRevisions: revisions.length,
  }
}
