import { SCORE_BLEND, QUALITY } from "../config.js"
import { computeLevelScore } from "./level.js"
import { computeMomentumScore } from "./momentum.js"
import { computePersistenceScore } from "./persistence.js"

/**
 * @param {number[]} historyValues
 * @param {import('../config.js').IndicatorConfig} cfg
 * @param {{ qualityStatus?: string }} [meta]
 */
export function computeIndicatorRiskScore(historyValues, cfg, meta = {}) {
  if (meta.qualityStatus === QUALITY.LICENSE_RESTRICTED) {
    return {
      score: null,
      level: null,
      momentum: null,
      persistence: null,
      quality: QUALITY.LICENSE_RESTRICTED,
      reason: "license_restricted",
    }
  }
  if (meta.qualityStatus === QUALITY.MISSING) {
    return {
      score: null,
      level: null,
      momentum: null,
      persistence: null,
      quality: QUALITY.MISSING,
      reason: "missing",
    }
  }
  if (meta.qualityStatus === QUALITY.STALE) {
    // Still compute but tag STALE — caller may exclude from CCI
  }

  if (cfg.precomputedRiskScore) {
    const current = historyValues[historyValues.length - 1]
    if (!Number.isFinite(current)) {
      return {
        score: null,
        level: null,
        momentum: null,
        persistence: null,
        quality: QUALITY.MISSING,
        reason: "precomputed_missing",
      }
    }
    const score = Math.round(Math.min(100, Math.max(0, current)))
    return {
      score,
      level: { score, reason: "precomputed" },
      momentum: { score: 50, reason: "precomputed_neutral_momentum" },
      persistence: { score: 50, reason: "precomputed_neutral_persistence" },
      quality: meta.qualityStatus ?? QUALITY.VALID,
      reason: "precomputed_passthrough",
    }
  }

  const level = computeLevelScore(historyValues, {
    riskDirection: cfg.riskDirection,
    minHistory: cfg.minHistoryForLevel,
  })
  const momentum = computeMomentumScore(historyValues, {
    riskDirection: cfg.riskDirection,
    shortPeriods: cfg.momentumShortPeriods,
    longPeriods: cfg.momentumLongPeriods,
  })
  const persistence = computePersistenceScore(historyValues, {
    riskDirection: cfg.riskDirection,
    lookback: cfg.persistenceLookback,
    riskThresholdPercentile: cfg.persistenceRiskThresholdPercentile,
    minHistory: cfg.minHistoryForLevel,
  })

  if (level.score == null || momentum.score == null || persistence.score == null) {
    return {
      score: null,
      level,
      momentum,
      persistence,
      quality: meta.qualityStatus ?? QUALITY.MISSING,
      reason: "component_unavailable",
    }
  }

  const blended =
    SCORE_BLEND.level * level.score +
    SCORE_BLEND.momentum * momentum.score +
    SCORE_BLEND.persistence * persistence.score

  return {
    score: Math.round(blended),
    level,
    momentum,
    persistence,
    quality: meta.qualityStatus ?? QUALITY.VALID,
    reason: "ok",
  }
}
