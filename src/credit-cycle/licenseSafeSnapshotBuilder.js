/**
 * Build Staging-shaped license-safe CCI snapshots from local FRED/FDIC caches.
 * - No remote writes. No HY/BBB numerics.
 * - FRED current-vintage → pit_status NON_PIT (never labeled PIT).
 * - Does not change engine weights; reuses computeCciAt(license_safe).
 * - Insufficient coverage → cci_score null + hold_reason (no invented CCI).
 */

import { getIndicatorConfig } from "./config.js"
import { computeCciAt } from "./engine.js"
import { classifyRegime } from "./regime.js"
import { LICENSE_SAFE_SERIES } from "./seriesMeta.js"
import { isStagingTestSeedPoint } from "./stagingTestSeed.js"

// Node-only cache loaders are imported dynamically inside buildLicenseSafeSnapshotsFromCache
// so browser bundles (creditCycleBridge) never pull node:fs.

export const LICENSE_SAFE_CALC_VERSION = "phase11-license-safe-local-v1"
export const LICENSE_SAFE_INDICATOR_IDS = ["sloos", "cpff", "bank", "cre", "corp_delinq"]

/**
 * @param {object} engineResult — computeCciAt output
 * @param {string} asOf
 * @param {{ priorCci?: number | null, priorRegime?: string | null }} [ctx]
 */
export function engineResultToLicenseSafeSnapshot(engineResult, asOf, ctx = {}) {
  if (isStagingTestSeedPoint({ asOf })) {
    throw new Error("refusing_test_seed_as_of")
  }

  const held =
    engineResult.status === "HOLD_LOW_COVERAGE" ||
    engineResult.cciStatus === "HOLD_LOW_COVERAGE" ||
    engineResult.cci == null

  const mom =
    engineResult.cci != null && ctx.priorCci != null
      ? engineResult.cci - ctx.priorCci
      : null

  const regime = classifyRegime({
    cci: engineResult.cci,
    cciMomentum: mom,
    worseningCount: (engineResult.indicators || []).filter(
      (s) => s.score != null && s.score >= 60,
    ).length,
    indicatorCount: (engineResult.indicators || []).filter((s) => s.score != null).length,
    persistenceShare: null,
    priorRegime: ctx.priorRegime || null,
  })

  /** @type {object[]} */
  const indicator_scores = []
  for (const id of LICENSE_SAFE_INDICATOR_IDS) {
    const row = (engineResult.indicators || []).find((i) => i.id === id)
    const cfg = getIndicatorConfig(id)
    const w = cfg?.weightNominal ?? null
    const score = row?.score ?? null
    indicator_scores.push({
      indicator_code: id,
      indicator_score: score,
      weighted_contribution:
        score != null && w != null ? Math.round(score * w * 1000) / 1000 : null,
      observation_date: row?.lastObservationDate || null,
      release_date: row?.releaseDate || row?.lastReleaseDate || null,
      quality_status: row?.quality || (score == null ? "MISSING" : "VALID"),
      license_restricted: false,
      // Prefer null for product rows when missing — never invent values
      raw_value: score == null ? null : row?.lastValue ?? null,
      series_id: LICENSE_SAFE_SERIES[id]?.seriesId || cfg?.seriesId || null,
      pit_label: "NON_PIT",
    })
  }

  // HY/BBB: placeholders only — no numerics (never include in product payload)
  for (const id of ["hy", "bbb"]) {
    indicator_scores.push({
      indicator_code: id,
      indicator_score: null,
      weighted_contribution: null,
      observation_date: null,
      release_date: null,
      quality_status: "LICENSE_RESTRICTED",
      license_restricted: true,
      raw_value: null,
      series_id: id === "hy" ? "BAMLH0A0HYM2" : "BAMLC0A4CBBB",
      pit_label: "NON_PIT",
    })
  }

  return {
    as_of_date: asOf,
    cci_score: held ? null : engineResult.cci,
    coverage: engineResult.coverage ?? null,
    confidence_status: engineResult.confidence || null,
    regime: regime.regime || null,
    calculation_version: LICENSE_SAFE_CALC_VERSION,
    data_mode: "license_safe",
    pit_status: "NON_PIT",
    hold_reason: held
      ? engineResult.status || engineResult.cciStatus || "HOLD_LOW_COVERAGE"
      : null,
    // Never store HY/BBB or research internals in product payload
    payload: null,
    indicator_scores,
    meta: {
      feedKind: "LICENSE_SAFE_LOCAL",
      source: "local_cache_fred_current_vintage_and_fdic_industry",
      pitNote: "FRED current-vintage caches are NON_PIT; do not label as PIT",
      hyBbbExcluded: true,
      stagingDbWrite: false,
      testSeed: false,
    },
  }
}

/**
 * @param {string} cacheRoot
 * @param {{ from?: string, to?: string, asOf?: string | null }} [opts]
 */
export async function buildLicenseSafeSnapshotsFromCache(cacheRoot, opts = {}) {
  const {
    buildQuarterAsOfDates,
    loadLicenseSafeSeriesMap,
    inventoryLocalCaches,
  } = await import("./localHistoryProvider.js")
  const inventory = await inventoryLocalCaches(cacheRoot)
  const seriesMap = await loadLicenseSafeSeriesMap(cacheRoot)

  const presentSafe = LICENSE_SAFE_INDICATOR_IDS.filter(
    (id) => (seriesMap[id] || []).length > 0,
  )
  const insufficientSources = presentSafe.length < 3

  const asOfDates = buildQuarterAsOfDates(seriesMap, {
    from: opts.from || "2018-01-01",
    to: opts.to,
  }).filter((d) => !isStagingTestSeedPoint({ asOf: d }))

  /** @type {object[]} */
  const snapshots = []
  let prevCci = null
  let priorRegime = null

  if (!insufficientSources) {
    for (const asOf of asOfDates) {
      const engine = computeCciAt(seriesMap, asOf, {
        mode: "license_safe",
        pitMode: "obs_date",
      })
      const snap = engineResultToLicenseSafeSnapshot(engine, asOf, {
        priorCci: prevCci,
        priorRegime,
      })
      if (snap.regime) priorRegime = snap.regime
      if (snap.cci_score != null) prevCci = snap.cci_score
      snapshots.push(snap)
    }
  }

  let latest = null
  if (opts.asOf && !isStagingTestSeedPoint({ asOf: opts.asOf })) {
    latest = snapshots.find((s) => s.as_of_date === opts.asOf) || null
  }
  if (!latest) {
    for (let i = snapshots.length - 1; i >= 0; i--) {
      if (snapshots[i].cci_score != null || snapshots[i].hold_reason) {
        latest = snapshots[i]
        break
      }
    }
  }

  const ready =
    !insufficientSources &&
    latest != null &&
    (latest.cci_score != null || latest.hold_reason != null)

  return {
    meta: {
      feedStatus: ready ? "LICENSE_SAFE_LOCAL" : "PREPARING",
      mode: "license_safe",
      pitLabel: "NON_PIT",
      calculationVersion: LICENSE_SAFE_CALC_VERSION,
      builtAt: new Date().toISOString(),
      cacheRoot,
      snapshotCount: snapshots.length,
      latestAsOf: latest?.as_of_date || null,
      insufficientSources,
      presentIndicators: presentSafe,
      warningEvidence: "INSUFFICIENT_EVIDENCE",
      stagingDbWrite: false,
      note:
        "Local license-safe snapshots from FRED current-vintage + FDIC industry cache. NON_PIT. HY/BBB excluded. Not written to Staging DB.",
    },
    inventory,
    latest,
    snapshots,
  }
}

/**
 * Map license-safe snapshot bundle → engine-shaped object for UI adapter.
 * @param {object} bundle
 */
export function licenseSafeBundleToEngineShape(bundle) {
  const latest = bundle?.latest
  if (!latest) return null
  const scores = Array.isArray(latest.indicator_scores) ? latest.indicator_scores : []
  return {
    mode: "license_safe",
    dataAsOfDate: latest.as_of_date,
    asOfDate: latest.as_of_date,
    cci: latest.cci_score,
    coverage: latest.coverage,
    confidence: latest.confidence_status,
    status: latest.hold_reason || (latest.cci_score == null ? "HOLD_OR_UNAVAILABLE" : "OK"),
    cciStatus: latest.hold_reason ? "HOLD_LOW_COVERAGE" : latest.cci_score == null ? "UNAVAILABLE" : "OK",
    pitStatus: latest.pit_status || "NON_PIT",
    regime: latest.regime
      ? { regime: latest.regime, status: "OK", reasons: [] }
      : { regime: null, status: "NOT_CLASSABLE", reasons: [] },
    indicators: scores
      .filter((s) => !s.license_restricted)
      .map((s) => ({
        id: s.indicator_code,
        score: s.indicator_score,
        quality: s.quality_status,
        lastObservationDate: s.observation_date,
        lastValue: s.raw_value,
        detail: null,
      })),
    licenseRestrictedIndicators: ["hy", "bbb"],
  }
}
