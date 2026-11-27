/**
 * Research_9 SOFR + ON RRP liquidity risk (0–100 composite).
 * Internal legs 50:50 → catalog sleeve weight 0.10 (0.05 + 0.05).
 * Thresholds: configResearch9.SOFR_LIQUIDITY_THRESHOLDS (hypotheses).
 */

import { clamp, percentileRank, sortedCopy } from "../math.js"
import { SOFR_LIQUIDITY_THRESHOLDS } from "../configResearch9.js"

const T = SOFR_LIQUIDITY_THRESHOLDS

/**
 * @param {number[]} values
 * @param {number} [window]
 */
export function rollingDiffVol(values, window = T.volWindow) {
  if (!Array.isArray(values) || values.length < window + 1) return null
  const slice = values.slice(values.length - (window + 1))
  const diffs = []
  for (let i = 1; i < slice.length; i++) {
    if (!Number.isFinite(slice[i]) || !Number.isFinite(slice[i - 1])) continue
    diffs.push(slice[i] - slice[i - 1])
  }
  if (diffs.length < Math.max(5, Math.floor(window / 2))) return null
  const mean = diffs.reduce((s, x) => s + x, 0) / diffs.length
  const varSum = diffs.reduce((s, x) => s + (x - mean) ** 2, 0) / diffs.length
  return Math.sqrt(varSum)
}

/**
 * @param {number[]} values
 */
export function recentSpikeScore(values, lookback = T.spikeLookback) {
  if (!Array.isArray(values) || values.length < lookback + 10) {
    return T.defaultSpikeScoreWhenShort
  }
  const diffs = []
  for (let i = 1; i < values.length; i++) {
    if (!Number.isFinite(values[i]) || !Number.isFinite(values[i - 1])) continue
    diffs.push(Math.abs(values[i] - values[i - 1]))
  }
  if (diffs.length < lookback + 5) return T.defaultSpikeScoreWhenShort
  const recent = diffs.slice(-lookback)
  const hist = sortedCopy(diffs.slice(0, -lookback))
  const recentMax = Math.max(...recent)
  const pct = percentileRank(hist, recentMax)
  if (pct == null) return T.defaultSpikeScoreWhenShort
  return Math.round(clamp(pct * 100, 0, 100) ?? T.defaultSpikeScoreWhenShort)
}

/**
 * SOFR funding-stress leg 0–100.
 * @param {object} args
 * @param {number[]} args.sofr
 * @param {number[]} args.policyRate
 */
export function computeSofrLegScore(args) {
  const sofr = args.sofr || []
  const policy = args.policyRate || []
  if (sofr.length < T.minLegHistory) {
    return { score: null, reason: "insufficient_sofr_history", flags: {} }
  }
  const s = sofr[sofr.length - 1]
  if (!Number.isFinite(s)) {
    return { score: null, reason: "missing_sofr", flags: {} }
  }

  const policyAvailable =
    policy.length >= 1 && Number.isFinite(policy[policy.length - 1])
  let gap = null
  /** @type {'observed'|'hypothesis_placeholder_not_observed'|null} */
  let gapScoreSource = null
  let policyRateMissing = false

  let gapScore
  if (policyAvailable) {
    gap = s - policy[policy.length - 1]
    gapScoreSource = "observed"
    const n = Math.min(sofr.length, policy.length)
    const gaps = []
    for (let i = sofr.length - n; i < sofr.length; i++) {
      const j = policy.length - n + (i - (sofr.length - n))
      if (Number.isFinite(sofr[i]) && Number.isFinite(policy[j])) {
        gaps.push(sofr[i] - policy[j])
      }
    }
    if (gaps.length >= T.minLegHistory) {
      const pct = percentileRank(sortedCopy(gaps), gap)
      gapScore = Math.round(clamp((pct ?? 0.5) * 100, 0, 100) ?? 45)
    } else {
      const abs = Math.abs(gap)
      gapScore = Math.round(
        clamp(
          T.gapAbsHeuristicBase + abs * T.gapAbsHeuristicScale,
          0,
          100,
        ) ?? 45,
      )
    }
  } else {
    // Explicit placeholder — not an observed gap, not a validated neutral midpoint.
    policyRateMissing = true
    gapScore = T.gapScoreWhenPolicyMissing
    gapScoreSource = T.gapScoreSourceWhenPolicyMissing
    gap = null
  }

  const vol = rollingDiffVol(sofr, T.volWindow)
  let volScore = T.defaultVolScore
  if (vol != null) {
    volScore = Math.round(clamp(vol * T.volScale, 0, 100) ?? T.defaultVolScore)
  }
  const spike = recentSpikeScore(sofr, T.spikeLookback)

  const b = T.sofrLegBlend
  const score = Math.round(
    clamp(b.gap * gapScore + b.vol * volScore + b.spike * spike, 0, 100) ?? 0,
  )
  return {
    score,
    reason: policyRateMissing ? "ok_policy_rate_missing" : "ok",
    gap,
    gapScore,
    gapScoreSource,
    vol,
    volScore,
    spikeScore: spike,
    flags: {
      policyRateMissing,
      gapUsesHypothesisPlaceholder: policyRateMissing,
      thresholdsAreHypothesis: true,
    },
    interpretationNote: policyRateMissing
      ? "Policy rate missing: gapScore is a research hypothesis placeholder, not an observed SOFR−policy spread. Vol/spike still drive part of the leg."
      : null,
  }
}

/**
 * ON RRP leg 0–100.
 * @param {object} args
 * @param {number[]} args.onRrp
 */
export function computeOnRrpLegScore(args) {
  const series = args.onRrp || []
  if (series.length < T.minLegHistory) {
    return { score: null, reason: "insufficient_rrp_history" }
  }
  const cur = series[series.length - 1]
  if (!Number.isFinite(cur)) return { score: null, reason: "missing_rrp" }

  const finite = series.filter((v) => Number.isFinite(v))
  const peak = Math.max(...finite)
  if (!(peak > 0)) return { score: null, reason: "invalid_rrp_peak" }

  const fillRatio = cur / peak
  const exhaustionRisk = Math.round(clamp((1 - fillRatio) * 100, 0, 100) ?? 50)

  const spikeUp = (() => {
    if (series.length < T.rrpSpikeLookback) return T.rrpSpikeQuietScore
    const prev = series[series.length - T.rrpSpikeLookback]
    if (!Number.isFinite(prev) || prev === 0) return T.rrpSpikeQuietScore
    const chg = (cur - prev) / Math.abs(prev)
    for (const cut of T.rrpSpikeCuts) {
      if (chg >= cut.minChg) return cut.score
    }
    return T.rrpSpikeQuietScore
  })()

  const prev = series[series.length - T.rrpSpikeLookback]
  const declining = Number.isFinite(prev) && cur < prev
  const abundantVsPeak = fillRatio >= T.rrpAbundantFillMin
  let declinePressure = 0
  if (declining && abundantVsPeak) {
    declinePressure = T.rrpDeclineRelief
  }

  const score = Math.round(
    clamp(
      T.rrpExhaustionWeight * exhaustionRisk +
        T.rrpSpikeWeight * spikeUp +
        T.rrpBaseWeight * T.rrpBaseScore +
        declinePressure,
      0,
      100,
    ) ?? 0,
  )

  return {
    score,
    reason: "ok",
    fillRatio,
    peak,
    exhaustionRisk,
    spikeUp,
    declining: !!declining,
    declinePressure,
    note: "rrp_decline_alone_does_not_raise_risk",
    flags: { thresholdsAreHypothesis: true },
  }
}

/**
 * @param {object} args
 * @param {number[]} args.sofr
 * @param {number[]} [args.policyRate]
 * @param {number[]} args.onRrp
 */
export function computeSofrLiquidityRiskScore(args) {
  const sofrLeg = computeSofrLegScore({
    sofr: args.sofr,
    policyRate: args.policyRate,
  })
  const rrpLeg = computeOnRrpLegScore({ onRrp: args.onRrp })

  if (sofrLeg.score == null || rrpLeg.score == null) {
    return {
      score: null,
      sofrLeg,
      rrpLeg,
      blend: { ...T.compositeBlend },
      reason: "leg_unavailable",
      qualityHint: "MISSING",
      flags: {
        policyRateMissing: Boolean(sofrLeg.flags?.policyRateMissing),
        thresholdsAreHypothesis: true,
      },
    }
  }

  const score = Math.round(
    T.compositeBlend.sofr * sofrLeg.score + T.compositeBlend.onRrp * rrpLeg.score,
  )
  const policyRateMissing = Boolean(sofrLeg.flags?.policyRateMissing)
  return {
    score,
    sofrLeg,
    rrpLeg,
    blend: { ...T.compositeBlend },
    subWeightSleeve: { sofr: 0.05, onRrp: 0.05, total: 0.1 },
    reason: policyRateMissing ? "ok_policy_rate_missing" : "ok",
    qualityHint: "VALID",
    flags: {
      policyRateMissing,
      gapUsesHypothesisPlaceholder: policyRateMissing,
      thresholdsAreHypothesis: true,
    },
    qualityFlags: policyRateMissing ? ["POLICY_RATE_MISSING"] : [],
    interpretationNote: sofrLeg.interpretationNote,
  }
}

export { SOFR_LIQUIDITY_THRESHOLDS }
