import { getIndicatorConfig, QUALITY } from "./config.js"
import { expandingHistoryAsOf, sortObservations } from "./normalize.js"
import { assessFreshness } from "./quality.js"
import { computeIndicatorRiskScore } from "./scores/indicator.js"
import { computeCci } from "./cci.js"
import { classifyRegime } from "./regime.js"

/**
 * Score one indicator at asOf from its observation list.
 * @param {string} indicatorId
 * @param {import('./normalize.js').Observation[]} observations
 * @param {string} asOfDate
 * @param {{ pitMode?: 'strict'|'obs_date', forceLicenseBlock?: boolean }} [opts]
 */
export function scoreIndicatorAt(indicatorId, observations, asOfDate, opts = {}) {
  const cfg = getIndicatorConfig(indicatorId)
  if (!cfg) {
    return { id: indicatorId, score: null, quality: QUALITY.INVALID, reason: "unknown_indicator" }
  }

  if (opts.forceLicenseBlock && cfg.licenseRestricted) {
    return {
      id: indicatorId,
      score: null,
      quality: QUALITY.LICENSE_RESTRICTED,
      reason: "license_restricted",
      cfg,
    }
  }

  const sorted = sortObservations(observations)
  const hist = expandingHistoryAsOf(sorted, asOfDate, {
    pitMode: opts.pitMode ?? "strict",
  })
  if (hist.values.length < 1) {
    return {
      id: indicatorId,
      score: null,
      quality: QUALITY.MISSING,
      pitStatus: hist.pitStatus,
      reason: "no_history",
      cfg,
    }
  }

  const lastDate = hist.dates[hist.dates.length - 1]
  const lastObs = sorted.filter((o) => o.observation_date === lastDate).pop()
  const fresh = assessFreshness({
    asOfDate,
    lastObservationDate: lastDate,
    frequency: cfg.frequency,
    maxStalePeriods: cfg.maxStalePeriods,
    releaseDate: lastObs?.release_date || lastObs?.realtime_start || null,
  })

  const quality =
    fresh.status === QUALITY.STALE
      ? QUALITY.STALE
      : fresh.status === QUALITY.DELAYED
        ? QUALITY.DELAYED
        : QUALITY.VALID

  const scored = computeIndicatorRiskScore(hist.values, cfg, { qualityStatus: quality })
  return {
    id: indicatorId,
    score: scored.score,
    quality: scored.quality,
    detail: scored,
    pitStatus: hist.pitStatus,
    freshness: fresh,
    lastObservationDate: lastDate,
    lastValue: hist.values[hist.values.length - 1],
    cfg,
  }
}

/**
 * @param {Record<string, import('./normalize.js').Observation[]>} seriesMap
 * @param {string} asOfDate
 * @param {{ mode: 'research'|'license_safe', pitMode?: 'strict'|'obs_date' }} opts
 */
export function computeCciAt(seriesMap, asOfDate, opts) {
  const ids =
    opts.mode === "license_safe"
      ? ["sloos", "cpff", "bank", "cre", "corp_delinq"]
      : ["hy", "bbb", "sloos", "cpff", "bank", "cre", "corp_delinq"]

  const scored = []
  /** @type {string[]} */
  const pitFlags = []
  for (const id of ids) {
    const rows = seriesMap[id] || seriesMap[getIndicatorConfig(id)?.seriesId || ""] || []
    const one = scoreIndicatorAt(id, rows, asOfDate, {
      pitMode: opts.pitMode,
      forceLicenseBlock: opts.mode === "license_safe",
    })
    scored.push(one)
    if (one.pitStatus) pitFlags.push(one.pitStatus)
  }

  let pitStatus = "PIT"
  if (pitFlags.includes("EMPTY") && pitFlags.every((p) => p === "EMPTY")) {
    pitStatus = "EMPTY"
  } else if (pitFlags.includes("NON_PIT")) {
    pitStatus = "NON_PIT"
  } else if (pitFlags.includes("EMPTY")) {
    pitStatus = "PARTIAL"
  }

  const cci = computeCci(
    scored.map((s) => ({ id: s.id, score: s.score, quality: s.quality })),
    { mode: opts.mode, asOfDate, pitStatus },
  )

  const worsening = scored.filter(
    (s) => s.detail?.momentum?.shortDelta != null && s.cfg &&
      ((s.cfg.riskDirection === "higher_is_risk" && s.detail.momentum.shortDelta > 0) ||
        (s.cfg.riskDirection === "lower_is_risk" && s.detail.momentum.shortDelta < 0)),
  ).length

  const elevated = scored.filter((s) => s.score != null && s.score >= 60).length
  const avail = scored.filter((s) => s.score != null).length

  const regime = classifyRegime({
    cci: cci.cci,
    cciMomentum: null,
    worseningCount: worsening,
    indicatorCount: avail || scored.length,
    persistenceShare: avail ? elevated / avail : null,
    priorRegime: null,
  })

  return {
    ...cci,
    indicators: scored,
    regime,
    dataAsOfDate: asOfDate,
  }
}
