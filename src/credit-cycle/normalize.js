import { QUALITY } from "./config.js"
import { parseIsoDate } from "./math.js"

/**
 * @typedef {object} Observation
 * @property {string} series_id
 * @property {string} observation_date  // YYYY-MM-DD
 * @property {string | null} [release_date]
 * @property {string | null} [realtime_start]
 * @property {string | null} [realtime_end]
 * @property {string | null} [retrieved_at]
 * @property {number | null} value
 * @property {string | null} [unit]
 * @property {'daily'|'monthly'|'quarterly'|string} frequency
 * @property {string} [source]
 * @property {boolean | null} [vintage_available]
 * @property {string} [quality_status]
 */

/**
 * Normalize a raw row into Observation. Invalid numeric → INVALID + null value.
 * @param {Partial<Observation> & Record<string, unknown>} row
 * @returns {Observation}
 */
export function normalizeObservation(row) {
  const series_id = String(row.series_id ?? row.seriesId ?? "").trim()
  const observation_date = String(row.observation_date ?? row.date ?? "").slice(
    0,
    10,
  )
  const release_date = row.release_date
    ? String(row.release_date).slice(0, 10)
    : row.realtime_start
      ? String(row.realtime_start).slice(0, 10)
      : null
  const realtime_start = row.realtime_start
    ? String(row.realtime_start).slice(0, 10)
    : release_date
  const realtime_end = row.realtime_end
    ? String(row.realtime_end).slice(0, 10)
    : null

  let value = row.value
  if (value === "." || value === "" || value == null) value = null
  else if (typeof value === "string") value = Number(value)
  if (!Number.isFinite(value)) value = null

  let quality_status = String(row.quality_status ?? QUALITY.VALID)
  if (!series_id || !parseIsoDate(observation_date)) {
    quality_status = QUALITY.INVALID
    value = null
  } else if (value == null) {
    quality_status = QUALITY.MISSING
  }

  return {
    series_id,
    observation_date,
    release_date,
    realtime_start,
    realtime_end,
    retrieved_at: row.retrieved_at ? String(row.retrieved_at) : null,
    value,
    unit: row.unit != null ? String(row.unit) : null,
    frequency: /** @type {any} */ (row.frequency ?? "daily"),
    source: row.source != null ? String(row.source) : "unknown",
    vintage_available:
      typeof row.vintage_available === "boolean" ? row.vintage_available : null,
    quality_status,
  }
}

/**
 * Sort ascending by observation_date; drop INVALID without date.
 * @param {Observation[]} rows
 */
export function sortObservations(rows) {
  return rows
    .filter((r) => parseIsoDate(r.observation_date) != null)
    .slice()
    .sort((a, b) => a.observation_date.localeCompare(b.observation_date))
}

/**
 * Available value as of asOfDate using release/realtime_start (PIT).
 * If release unknown, uses conservative mode: only observation_date <= asOf AND
 * marks pit_status accordingly — does NOT invent release lags.
 *
 * @param {Observation[]} sorted
 * @param {string} asOfDate
 * @param {{ requireReleaseKnown?: boolean, conservativeLagDays?: number | null }} [opts]
 */
export function pickAvailableAsOf(sorted, asOfDate, opts = {}) {
  const requireReleaseKnown = opts.requireReleaseKnown === true
  const conservativeLagDays =
    opts.conservativeLagDays == null ? null : opts.conservativeLagDays

  /** @type {Observation | null} */
  let best = null
  for (const obs of sorted) {
    if (obs.value == null) continue
    if (obs.quality_status === QUALITY.INVALID) continue

    const release =
      obs.release_date || obs.realtime_start || null
    if (requireReleaseKnown && !release) continue

    if (release) {
      if (release > asOfDate) continue
      if (obs.observation_date > asOfDate) {
        // release before asOf but obs date after — still usable for PIT if released
      }
    } else {
      // Unknown release: never treat quarter-end as immediately available.
      if (conservativeLagDays != null) {
        // Approximate: require observation_date + lag <= asOf
        const t0 = parseIsoDate(obs.observation_date)
        const t1 = parseIsoDate(asOfDate)
        if (t0 == null || t1 == null) continue
        if (t1 < t0 + conservativeLagDays * 86400000) continue
      } else {
        // Strict: without release metadata, only allow if observation_date <= asOf
        // AND caller accepts NON_PIT (flagged by caller).
        if (obs.observation_date > asOfDate) continue
      }
    }

    if (!best || obs.observation_date >= best.observation_date) {
      // Prefer later observation among those available
      if (
        !best ||
        obs.observation_date > best.observation_date ||
        (release &&
          best.release_date &&
          release >= (best.release_date || best.realtime_start || ""))
      ) {
        best = obs
      }
    }
  }

  return best
}

/**
 * History of values available at asOf (for expanding-window percentiles).
 * Uses only observations with release_date/realtime_start <= asOf when present;
 * otherwise observation_date <= asOf (NON_PIT path).
 * @param {Observation[]} sorted
 * @param {string} asOfDate
 * @param {{ pitMode?: 'strict'|'obs_date' }} [opts]
 * @returns {{ values: number[], dates: string[], pitStatus: 'PIT'|'NON_PIT'|'EMPTY' }}
 */
export function expandingHistoryAsOf(sorted, asOfDate, opts = {}) {
  const pitMode = opts.pitMode ?? "strict"
  const values = []
  const dates = []
  let usedRelease = false
  let usedObsOnly = false

  for (const obs of sorted) {
    if (obs.value == null || !Number.isFinite(obs.value)) continue
    if (obs.quality_status === QUALITY.INVALID) continue
    const release = obs.release_date || obs.realtime_start || null
    if (pitMode === "strict" && release) {
      if (release > asOfDate) continue
      usedRelease = true
    } else if (pitMode === "strict" && !release) {
      // Without release, cannot claim PIT — include only for NON_PIT path if obs_date <= asOf
      if (obs.observation_date > asOfDate) continue
      usedObsOnly = true
    } else {
      // obs_date mode
      if (obs.observation_date > asOfDate) continue
      usedObsOnly = true
    }
    values.push(obs.value)
    dates.push(obs.observation_date)
  }

  if (values.length < 1) {
    return { values, dates, pitStatus: "EMPTY" }
  }
  if (usedRelease && !usedObsOnly) return { values, dates, pitStatus: "PIT" }
  if (usedRelease && usedObsOnly) return { values, dates, pitStatus: "NON_PIT" }
  return { values, dates, pitStatus: "NON_PIT" }
}
