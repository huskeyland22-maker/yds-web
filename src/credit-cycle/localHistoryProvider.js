/**
 * Local historical data provider — reads Phase 2/3 FRED·FDIC caches.
 * Does not call remote APIs. Does not invent release dates for FRED current vintage.
 * HY/BBB values are never written into UI-facing bundles.
 */

import { readdir, readFile, access } from "node:fs/promises"
import path from "node:path"
import { normalizeObservation, sortObservations } from "./normalize.js"
import { computeCciAt } from "./engine.js"
import { classifyRegime } from "./regime.js"
import { LICENSE_SAFE_SERIES, RESTRICTED_SERIES } from "./seriesMeta.js"

export { LICENSE_SAFE_SERIES, RESTRICTED_SERIES }

/**
 * @param {string} cacheRoot  e.g. .cache/credit-cycle
 */
export function cachePaths(cacheRoot) {
  return {
    root: cacheRoot,
    alfred: path.join(cacheRoot, "alfred"),
    fdic: path.join(cacheRoot, "fdic-industry"),
    seriesFile: (seriesId) => path.join(cacheRoot, `${seriesId}.json`),
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"))
}

async function exists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * FRED current-vintage cache → observations (NON_PIT).
 * Does not invent release_date; vintage_available=false.
 * @param {object} payload
 * @param {string} seriesId
 * @param {'daily'|'monthly'|'quarterly'} frequency
 * @param {string} [retrievedAt]
 */
export function fredCurrentToObservations(payload, seriesId, frequency, retrievedAt) {
  const retrieved = retrievedAt || payload.retrieved_at || null
  return sortObservations(
    (payload.observations || [])
      .map((o) =>
        normalizeObservation({
          series_id: seriesId,
          observation_date: o.date,
          value: o.value,
          frequency,
          source: "fred_current_vintage_local_cache",
          vintage_available: false,
          retrieved_at: retrieved,
          // FRED bulk current file may include realtime_* of the fetch day — that is NOT
          // the historical first-release date. Do not treat as PIT release.
          realtime_start: null,
          realtime_end: null,
          release_date: null,
        }),
      )
      .filter((o) => o.value != null),
  )
}

/**
 * Load all FDIC industry aggregate bank soundness points from cache dir.
 * Uses stored bankSoundness.score; release_date = observation + 60d (documented lag estimate).
 * @param {string} fdicDir
 */
export async function loadBankSoundnessObservations(fdicDir) {
  let files = []
  try {
    files = (await readdir(fdicDir)).filter((f) => f.endsWith(".json")).sort()
  } catch {
    return []
  }
  /** @type {import('./normalize.js').Observation[]} */
  const rows = []
  for (const f of files) {
    try {
      const j = await readJson(path.join(fdicDir, f))
      const score = j.bankSoundness?.score
      const od = j.industry?.observation_date || null
      if (score == null || !od) continue
      const [y, m, d] = od.split("-").map(Number)
      const release = new Date(Date.UTC(y, m - 1, d))
      release.setUTCDate(release.getUTCDate() + 60)
      const release_date = release.toISOString().slice(0, 10)
      rows.push(
        normalizeObservation({
          series_id: "FDIC_BANK_SOUNDNESS",
          observation_date: od,
          release_date,
          realtime_start: release_date,
          value: score,
          frequency: "quarterly",
          source: "fdic_industry_aggregate_local_cache",
          vintage_available: false,
          retrieved_at: j.retrieved_at || null,
          quality_status: "VALID",
        }),
      )
    } catch {
      /* skip corrupt */
    }
  }
  return sortObservations(rows)
}

/**
 * @param {import('./normalize.js').Observation[]} obs
 */
export function summarizeSeries(obs, extra = {}) {
  const dates = obs.map((o) => o.observation_date)
  return {
    count: obs.length,
    firstObservationDate: dates[0] || null,
    lastObservationDate: dates[dates.length - 1] || null,
    frequency: obs[0]?.frequency || null,
    source: obs[0]?.source || null,
    hasReleaseDates: obs.some((o) => o.release_date != null),
    pitCapableFromThisFile: false,
    ...extra,
  }
}

/**
 * Inventory local caches without exposing HY/BBB values.
 * @param {string} cacheRoot
 */
export async function inventoryLocalCaches(cacheRoot) {
  const paths = cachePaths(cacheRoot)
  /** @type {Record<string, object>} */
  const indicators = {}

  for (const [id, meta] of Object.entries(LICENSE_SAFE_SERIES)) {
    if (id === "bank") {
      const obs = await loadBankSoundnessObservations(paths.fdic)
      indicators[id] = {
        id,
        label: meta.label,
        seriesId: meta.seriesId,
        licenseRestricted: false,
        unit: meta.unit,
        ...summarizeSeries(obs, {
          frequency: meta.frequency,
          cachePath: paths.fdic,
          alfredRealtimePresent: false,
        }),
      }
      continue
    }
    const file = paths.seriesFile(meta.seriesId)
    if (!(await exists(file))) {
      indicators[id] = {
        id,
        label: meta.label,
        seriesId: meta.seriesId,
        licenseRestricted: false,
        present: false,
        count: 0,
      }
      continue
    }
    const payload = await readJson(file)
    const obs = fredCurrentToObservations(payload, meta.seriesId, meta.frequency)
    const alfredFile = path.join(paths.alfred, `${meta.seriesId}.realtime.json`)
    indicators[id] = {
      id,
      label: meta.label,
      seriesId: meta.seriesId,
      licenseRestricted: false,
      unit: meta.unit,
      present: true,
      retrievedAt: payload.retrieved_at || null,
      ...summarizeSeries(obs, {
        frequency: meta.frequency,
        cachePath: file,
        alfredRealtimePresent: await exists(alfredFile),
        note: "FRED current vintage = NON_PIT for product path",
      }),
    }
  }

  for (const [id, meta] of Object.entries(RESTRICTED_SERIES)) {
    const file = paths.seriesFile(meta.seriesId)
    const present = await exists(file)
    let count = 0
    let first = null
    let last = null
    let retrievedAt = null
    if (present) {
      const payload = await readJson(file)
      retrievedAt = payload.retrieved_at || null
      const vals = (payload.observations || []).filter(
        (o) => o.value != null && o.value !== "." && o.value !== "",
      )
      count = vals.length
      const dates = vals.map((o) => o.date).filter(Boolean).sort()
      first = dates[0] || null
      last = dates[dates.length - 1] || null
    }
    indicators[id] = {
      id,
      label: meta.label,
      seriesId: meta.seriesId,
      licenseRestricted: true,
      present,
      count,
      firstObservationDate: first,
      lastObservationDate: last,
      frequency: meta.frequency,
      retrievedAt,
      valuesExportedToUi: false,
      note: "ICE license restricted — values not exported to UI bundle",
    }
  }

  return {
    cacheRoot,
    scannedAt: new Date().toISOString(),
    indicators,
  }
}

/**
 * Load license-safe observation map for CCI engine.
 * @param {string} cacheRoot
 * @returns {Promise<Record<string, import('./normalize.js').Observation[]>>}
 */
export async function loadLicenseSafeSeriesMap(cacheRoot) {
  const paths = cachePaths(cacheRoot)
  /** @type {Record<string, import('./normalize.js').Observation[]>} */
  const map = {}
  for (const [id, meta] of Object.entries(LICENSE_SAFE_SERIES)) {
    if (id === "bank") {
      map.bank = await loadBankSoundnessObservations(paths.fdic)
      continue
    }
    const file = paths.seriesFile(meta.seriesId)
    if (!(await exists(file))) {
      map[id] = []
      continue
    }
    const payload = await readJson(file)
    map[id] = fredCurrentToObservations(payload, meta.seriesId, meta.frequency)
  }
  return map
}

/**
 * Quarter-end as-of dates from overlapping series (YYYY-MM-DD).
 * @param {Record<string, import('./normalize.js').Observation[]>} seriesMap
 * @param {{ from?: string, to?: string }} [range]
 */
export function buildQuarterAsOfDates(seriesMap, range = {}) {
  const from = range.from || "2015-01-01"
  const to = range.to || "2099-12-31"
  const set = new Set()
  for (const id of ["sloos", "cre", "corp_delinq", "bank"]) {
    for (const o of seriesMap[id] || []) {
      if (o.observation_date >= from && o.observation_date <= to) {
        // Normalize to quarter-ish ends already in data
        set.add(o.observation_date)
      }
    }
  }
  // Also include month-ends near CPFF for denser recent path? Keep quarterly for CCI path.
  return [...set].sort()
}

/**
 * @param {import('./normalize.js').Observation[]} obs
 * @param {number} [maxPoints]
 */
export function seriesPointsForUi(obs, maxPoints = 400) {
  if (!obs.length) return []
  let rows = obs
  if (obs.length > maxPoints) {
    const step = Math.ceil(obs.length / maxPoints)
    rows = obs.filter((_, i) => i % step === 0 || i === obs.length - 1)
  }
  return rows.map((o) => ({
    observationDate: o.observation_date,
    releaseDate: o.release_date,
    value: o.value,
    retrievedAt: o.retrieved_at,
    source: o.source,
    qualityStatus: o.quality_status || null,
  }))
}

/**
 * Build UI-facing local history bundle (no HY/BBB values).
 * @param {string} cacheRoot
 * @param {{ researchHistory?: object | null, asOf?: string | null }} [opts]
 */
export async function buildLocalHistoryUiBundle(cacheRoot, opts = {}) {
  const inventory = await inventoryLocalCaches(cacheRoot)
  const seriesMap = await loadLicenseSafeSeriesMap(cacheRoot)

  const asOfDates = buildQuarterAsOfDates(seriesMap, { from: "2018-01-01" })
  /** @type {Array<object>} */
  const cciPath = []
  let prevCci = null
  let priorRegime = null
  for (const asOf of asOfDates) {
    const r = computeCciAt(seriesMap, asOf, {
      mode: "license_safe",
      pitMode: "obs_date",
    })
    const mom = r.cci != null && prevCci != null ? r.cci - prevCci : null
    const regime = classifyRegime({
      cci: r.cci,
      cciMomentum: mom,
      worseningCount: (r.indicators || []).filter((s) => s.score != null && s.score >= 60)
        .length,
      indicatorCount: (r.indicators || []).filter((s) => s.score != null).length,
      persistenceShare: null,
      priorRegime,
    })
    if (regime.regime) priorRegime = regime.regime
    cciPath.push({
      asOf,
      cci: r.cci,
      cciMomentum: mom,
      coverage: r.coverage,
      confidence: r.confidence,
      cciStatus: r.status,
      pit: "NON_PIT",
      regime: regime.regime,
      regimeStatus: regime.status,
      indicators: (r.indicators || []).map((i) => ({
        id: i.id,
        score: i.score,
        quality: i.quality,
        lastObservationDate: i.lastObservationDate || null,
        lastValue: i.lastValue ?? null,
      })),
    })
    if (r.cci != null) prevCci = r.cci
  }

  const latestAsOf =
    opts.asOf ||
    asOfDates[asOfDates.length - 1] ||
    null

  let latestEngine = null
  let priorPathCci = null
  if (latestAsOf) {
    latestEngine = computeCciAt(seriesMap, latestAsOf, {
      mode: "license_safe",
      pitMode: "obs_date",
    })
    const idx = cciPath.findIndex((p) => p.asOf === latestAsOf)
    if (idx > 0) priorPathCci = cciPath[idx - 1]?.cci ?? null
  }

  /** @type {Record<string, object>} */
  const series = {}
  for (const [id, meta] of Object.entries(LICENSE_SAFE_SERIES)) {
    const obs = seriesMap[id] || []
    const last = obs[obs.length - 1]
    const prev = obs[obs.length - 2]
    series[id] = {
      id,
      label: meta.label,
      seriesId: meta.seriesId,
      frequency: meta.frequency,
      unit: meta.unit,
      licenseRestricted: false,
      pitLabel: "NON_PIT",
      source: last?.source || null,
      retrievedAt: last?.retrieved_at || inventory.indicators[id]?.retrievedAt || null,
      lastObservationDate: last?.observation_date || null,
      lastReleaseDate: last?.release_date || null,
      lastValue: last?.value ?? null,
      priorValue: prev?.value ?? null,
      delta:
        last?.value != null && prev?.value != null
          ? Math.round((last.value - prev.value) * 1000) / 1000
          : null,
      points: seriesPointsForUi(obs, id === "cpff" ? 500 : 200),
    }
  }
  for (const [id, meta] of Object.entries(RESTRICTED_SERIES)) {
    series[id] = {
      id,
      label: meta.label,
      seriesId: meta.seriesId,
      frequency: meta.frequency,
      licenseRestricted: true,
      pitLabel: "NON_PIT",
      valuesExcluded: true,
      cachePresent: inventory.indicators[id]?.present || false,
      countInCache: inventory.indicators[id]?.count || 0,
      points: [],
      lastValue: null,
      priorValue: null,
      delta: null,
    }
  }

  return {
    meta: {
      feedStatus: "LOCAL_CACHE",
      mode: "license_safe",
      pitLabel: "NON_PIT",
      source: "local_cache_fred_current_vintage_and_fdic_industry",
      builtAt: new Date().toISOString(),
      asOf: latestAsOf,
      warningEvidence: "INSUFFICIENT_EVIDENCE",
      warningThresholdsLocked: false,
      note:
        "로컬 FRED current-vintage + FDIC 산업집계 캐시. ALFRED PIT 연구 경로와 별개. HY/BBB 수치 미포함. 실시간 API·Cron 아님.",
    },
    inventory,
    latestEngine,
    priorCci: priorPathCci,
    cciPath,
    series,
    researchHistory: opts.researchHistory || null,
  }
}
