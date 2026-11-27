/**
 * Independent research_9 catalog — does NOT mutate product license_safe or research-7 config.
 * Weights are research hypotheses (sum = 1.00), not optimized production values.
 */

import { QUALITY } from "./config.js"

/** @typedef {'daily'|'monthly'|'quarterly'} Frequency */

/**
 * @typedef {object} Research9IndicatorConfig
 * @property {string} id
 * @property {string} label
 * @property {number} weightNominal
 * @property {Frequency} frequency
 * @property {number} maxStalePeriods
 * @property {boolean} [reuseUnivariateScorer]  // existing L/M/P or bank precomputed via scoreIndicatorAt
 * @property {boolean} [precomputedComposite]
 * @property {boolean} [licenseSensitive]  // HY/BBB — included in research_9; still blocked in product UI
 * @property {{ sofr: number, onRrp: number }} [subWeights]
 */

/** @type {Research9IndicatorConfig[]} */
export const RESEARCH_9_INDICATORS = [
  {
    id: "hy",
    label: "HY Spread",
    weightNominal: 0.2,
    frequency: "daily",
    maxStalePeriods: 5,
    reuseUnivariateScorer: true,
    licenseSensitive: true,
  },
  {
    id: "bbb",
    label: "BBB Spread",
    weightNominal: 0.17,
    frequency: "daily",
    maxStalePeriods: 5,
    reuseUnivariateScorer: true,
    licenseSensitive: true,
  },
  {
    id: "sloos",
    label: "Fed SLOOS",
    weightNominal: 0.18,
    frequency: "quarterly",
    maxStalePeriods: 2,
    reuseUnivariateScorer: true,
  },
  {
    id: "yield_curve",
    label: "Yield Curve (10Y-3M primary)",
    weightNominal: 0.1,
    frequency: "daily",
    maxStalePeriods: 5,
    precomputedComposite: true,
  },
  {
    id: "sofr_liquidity",
    label: "SOFR + ON RRP Liquidity",
    weightNominal: 0.1,
    frequency: "daily",
    maxStalePeriods: 5,
    precomputedComposite: true,
    /** Conceptual split inside the 0.10 sleeve — both must sum to weightNominal. */
    subWeights: { sofr: 0.05, onRrp: 0.05 },
  },
  {
    id: "cpff",
    label: "CPFF / CP−EFFR",
    weightNominal: 0.07,
    frequency: "daily",
    maxStalePeriods: 5,
    reuseUnivariateScorer: true,
  },
  {
    id: "bank",
    label: "FDIC Bank Soundness",
    weightNominal: 0.07,
    frequency: "quarterly",
    maxStalePeriods: 2,
    reuseUnivariateScorer: true,
  },
  {
    id: "cre",
    label: "CRE Delinquency",
    weightNominal: 0.07,
    frequency: "quarterly",
    maxStalePeriods: 2,
    reuseUnivariateScorer: true,
  },
  {
    id: "corp_delinq",
    label: "Corporate Delinquency",
    weightNominal: 0.04,
    frequency: "quarterly",
    maxStalePeriods: 2,
    reuseUnivariateScorer: true,
  },
]

export const RESEARCH_9_MODE = "research_9"

/** SeriesMap key aliases for composite inputs (FRED-style ids accepted). */
export const RESEARCH_9_SERIES_ALIASES = {
  yield_10y3m: ["yield_10y3m", "T10Y3M", "t10y3m"],
  yield_10y2y: ["yield_10y2y", "T10Y2Y", "t10y2y"],
  sofr: ["sofr", "SOFR"],
  on_rrp: ["on_rrp", "RRPONTSYD", "rrpontsyd"],
  policy_rate: ["policy_rate", "EFFR", "effr", "IORB", "iorb"],
}

export function research9Indicators() {
  return RESEARCH_9_INDICATORS.slice()
}

export function research9WeightSum() {
  return RESEARCH_9_INDICATORS.reduce((s, c) => s + c.weightNominal, 0)
}

export function research9SofrSubWeightSum() {
  const row = RESEARCH_9_INDICATORS.find((c) => c.id === "sofr_liquidity")
  if (!row?.subWeights) return 0
  return row.subWeights.sofr + row.subWeights.onRrp
}

/**
 * Yield Curve scorer thresholds — research hypotheses, not calibrated production cuts.
 * Numeric values match the original hard-coded constants (do not “retune” here casually).
 */
export const YIELD_CURVE_THRESHOLDS = {
  thresholdsAreHypothesis: true,
  minPrimaryHistory: 5,
  minNormalizationHistory: 20,
  /** spread <= this → DEEP_INVERSION */
  deepInversionMax: -0.5,
  /** spread < 0 (and above deep) → SHALLOW_INVERSION */
  inversionBoundary: 0,
  /** 0 <= spread <= flatMax → FLAT */
  flatMax: 0.25,
  /** flatMax < spread <= normalMax → NORMAL; else STEEP */
  normalMax: 1.0,
  slopeRiskHint: {
    DEEP_INVERSION: 78,
    SHALLOW_INVERSION: 62,
    FLAT: 48,
    NORMAL: 32,
    STEEP: 28,
  },
  durationNoInversionScore: 18,
  durationQuarterPeriods: 63,
  durationBase: 25,
  durationScale: 55,
  durationExpK: 0.85,
  normalizationLookback: 252,
  normalizationStillInvertedScore: 40,
  normalizationNoRecentInversionScore: 28,
  normalizationAtTroughScore: 45,
  /** speed (pp/period) descending cuts → score */
  normalizationSpeedCuts: [
    { minSpeed: 0.04, score: 82 },
    { minSpeed: 0.025, score: 72 },
    { minSpeed: 0.015, score: 58 },
    { minSpeed: 0.008, score: 48 },
  ],
  normalizationSlowScore: 36,
  disagreementSignAdj: 8,
  disagreementLevelGapMin: 0.75,
  disagreementLevelGapAdj: 5,
  blendWeights: { slope: 0.35, duration: 0.35, normalization: 0.3 },
}

/**
 * SOFR + ON RRP scorer thresholds — research hypotheses.
 * Values preserved from original hard-coded constants.
 */
export const SOFR_LIQUIDITY_THRESHOLDS = {
  thresholdsAreHypothesis: true,
  minLegHistory: 21,
  volWindow: 21,
  /** scales daily SOFR diff vol into 0–100 (hypothesis) */
  volScale: 5000,
  spikeLookback: 5,
  /**
   * Used only when policy rate is missing — NOT an observed gap and NOT a validated neutral.
   * Flagged via policyRateMissing / gapScoreSource in scorer output.
   */
  gapScoreWhenPolicyMissing: 45,
  gapScoreSourceWhenPolicyMissing: "hypothesis_placeholder_not_observed",
  gapAbsHeuristicBase: 40,
  gapAbsHeuristicScale: 200,
  sofrLegBlend: { gap: 0.45, vol: 0.3, spike: 0.25 },
  defaultVolScore: 40,
  defaultSpikeScoreWhenShort: 30,
  rrpSpikeLookback: 6,
  rrpSpikeCuts: [
    { minChg: 0.25, score: 85 },
    { minChg: 0.1, score: 65 },
    { minChg: 0.05, score: 50 },
  ],
  rrpSpikeQuietScore: 28,
  rrpExhaustionWeight: 0.55,
  rrpSpikeWeight: 0.35,
  rrpBaseWeight: 0.1,
  rrpBaseScore: 40,
  rrpAbundantFillMin: 0.9,
  rrpDeclineRelief: -8,
  compositeBlend: { sofr: 0.5, onRrp: 0.5 },
}

export { QUALITY }
