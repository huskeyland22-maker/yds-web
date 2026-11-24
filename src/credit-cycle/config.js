/**
 * Credit Cycle indicator config — research hypothesis weights, NOT production-final.
 * Panic Index (VIX/CNN/PutCall) is intentionally excluded.
 */

/** @typedef {'daily'|'monthly'|'quarterly'} Frequency */
/** @typedef {'higher_is_risk'|'lower_is_risk'} RiskDirection */

/**
 * @typedef {object} IndicatorConfig
 * @property {string} id
 * @property {string} seriesId
 * @property {string} label
 * @property {number} weightNominal  // research hypothesis 0–1
 * @property {Frequency} frequency
 * @property {RiskDirection} riskDirection
 * @property {boolean} licenseRestricted
 * @property {boolean} inResearchCci
 * @property {boolean} inLicenseSafeCci
 * @property {number} minHistoryForLevel
 * @property {number} maxStalePeriods  // periods (days/months/quarters) before STALE
 * @property {number} momentumShortPeriods
 * @property {number} momentumLongPeriods
 * @property {number} persistenceLookback
 * @property {number} persistenceRiskThresholdPercentile // rolling percentile above = "elevated"
 * @property {boolean} [precomputedRiskScore] // already 0–100; skip L/M/P recompute
 */

/** @type {IndicatorConfig[]} */
export const INDICATOR_CONFIG = [
  {
    id: "hy",
    seriesId: "BAMLH0A0HYM2",
    label: "HY OAS",
    weightNominal: 0.2,
    frequency: "daily",
    riskDirection: "higher_is_risk",
    licenseRestricted: true,
    inResearchCci: true,
    inLicenseSafeCci: false,
    minHistoryForLevel: 60,
    maxStalePeriods: 5,
    momentumShortPeriods: 5,
    momentumLongPeriods: 21,
    persistenceLookback: 21,
    persistenceRiskThresholdPercentile: 70,
  },
  {
    id: "bbb",
    seriesId: "BAMLC0A4CBBB",
    label: "BBB OAS",
    weightNominal: 0.15,
    frequency: "daily",
    riskDirection: "higher_is_risk",
    licenseRestricted: true,
    inResearchCci: true,
    inLicenseSafeCci: false,
    minHistoryForLevel: 60,
    maxStalePeriods: 5,
    momentumShortPeriods: 5,
    momentumLongPeriods: 21,
    persistenceLookback: 21,
    persistenceRiskThresholdPercentile: 70,
  },
  {
    id: "sloos",
    seriesId: "DRTSCILM",
    label: "Fed SLOOS C&I tightening",
    weightNominal: 0.2,
    frequency: "quarterly",
    riskDirection: "higher_is_risk",
    licenseRestricted: false,
    inResearchCci: true,
    inLicenseSafeCci: true,
    minHistoryForLevel: 12,
    maxStalePeriods: 2,
    momentumShortPeriods: 1,
    momentumLongPeriods: 4,
    persistenceLookback: 4,
    persistenceRiskThresholdPercentile: 70,
  },
  {
    id: "cpff",
    seriesId: "CPFF",
    label: "CP − EFFR",
    weightNominal: 0.1,
    frequency: "daily",
    riskDirection: "higher_is_risk",
    licenseRestricted: false,
    inResearchCci: true,
    inLicenseSafeCci: true,
    minHistoryForLevel: 60,
    maxStalePeriods: 5,
    momentumShortPeriods: 5,
    momentumLongPeriods: 21,
    persistenceLookback: 21,
    persistenceRiskThresholdPercentile: 70,
  },
  {
    id: "bank",
    seriesId: "FDIC_BANK_SOUNDNESS",
    label: "Bank Soundness (FDIC ratios)",
    weightNominal: 0.1,
    frequency: "quarterly",
    riskDirection: "higher_is_risk",
    licenseRestricted: false,
    inResearchCci: true,
    inLicenseSafeCci: true,
    /** Values are already 0–100 composites from bankSoundness.js */
    precomputedRiskScore: true,
    minHistoryForLevel: 1,
    maxStalePeriods: 2,
    momentumShortPeriods: 1,
    momentumLongPeriods: 4,
    persistenceLookback: 4,
    persistenceRiskThresholdPercentile: 70,
  },
  {
    id: "cre",
    seriesId: "DRCRELEXFACBS",
    label: "CRE delinquency",
    weightNominal: 0.1,
    frequency: "quarterly",
    riskDirection: "higher_is_risk",
    licenseRestricted: false,
    inResearchCci: true,
    inLicenseSafeCci: true,
    minHistoryForLevel: 12,
    maxStalePeriods: 2,
    momentumShortPeriods: 1,
    momentumLongPeriods: 4,
    persistenceLookback: 4,
    persistenceRiskThresholdPercentile: 70,
  },
  {
    id: "corp_delinq",
    seriesId: "DRBLACBS",
    label: "Business loan delinquency",
    weightNominal: 0.15,
    frequency: "quarterly",
    riskDirection: "higher_is_risk",
    licenseRestricted: false,
    inResearchCci: true,
    inLicenseSafeCci: true,
    minHistoryForLevel: 12,
    maxStalePeriods: 2,
    momentumShortPeriods: 1,
    momentumLongPeriods: 4,
    persistenceLookback: 4,
    persistenceRiskThresholdPercentile: 70,
  },
]

/** Charge-off series — analyzed for redundancy, NOT in default CCI weights. */
export const CORP_CHARGEOFF = {
  id: "corp_chargeoff",
  seriesId: "CORBLACBS",
  label: "Business loan charge-off",
  note: "Not dual-weighted with DRBLACBS in default CCI",
}

export const SCORE_BLEND = {
  level: 0.6,
  momentum: 0.3,
  persistence: 0.1,
}

/** Research hypotheses — not locked production thresholds. */
export const CCI_POLICY = {
  coverageHoldBelow: 0.7,
  missingWeightWarnAbove: 0.25,
  weightsAreHypothesis: true,
}

export const BANK_SOUNDNESS_BLEND = {
  // Capital: lower capital = higher risk (inverted in scorer)
  // Asset quality / charge-offs / allowance: higher = higher risk
  // Do NOT merge IDT1CER and RBC1AAJ into one continuous series.
  capitalFieldByEra: {
    gfcPreferred: "RBC1AAJ",
    modernPreferred: "IDT1CER",
    modernFrom: "2015-01-01",
  },
  componentWeights: {
    capitalStress: 0.35,
    noncurrentLoans: 0.3,
    netChargeOff: 0.2,
    allowance: 0.15,
  },
}

export const QUALITY = {
  VALID: "VALID",
  MISSING: "MISSING",
  STALE: "STALE",
  DELAYED: "DELAYED",
  VINTAGE_UNAVAILABLE: "VINTAGE_UNAVAILABLE",
  INVALID: "INVALID",
  LICENSE_RESTRICTED: "LICENSE_RESTRICTED",
}

export const REGIME_IDS = [
  "Expansion",
  "Overheating",
  "Tightening",
  "Crisis",
  "Recovery",
]

/** Temporary score bands — calibrate via backtest; not final. */
export const REGIME_SCORE_BANDS_HYPOTHESIS = [
  { id: "low", min: 0, max: 19 },
  { id: "below_avg", min: 20, max: 39 },
  { id: "watch", min: 40, max: 59 },
  { id: "elevated", min: 60, max: 79 },
  { id: "extreme", min: 80, max: 100 },
]

export function getIndicatorConfig(id) {
  return INDICATOR_CONFIG.find((c) => c.id === id) ?? null
}

export function researchIndicators() {
  return INDICATOR_CONFIG.filter((c) => c.inResearchCci)
}

export function licenseSafeIndicators() {
  return INDICATOR_CONFIG.filter((c) => c.inLicenseSafeCci)
}
