/**
 * Regime engine — hypothesis rules combining level, momentum, breadth, persistence.
 * Bands are temporary; must be calibrated with backtests.
 */

/**
 * @param {object} input
 * @param {number | null} input.cci
 * @param {number | null} input.cciMomentum  // delta of CCI over confirm window, risk-up positive
 * @param {number} input.worseningCount  // indicators with rising risk momentum
 * @param {number} input.indicatorCount
 * @param {number | null} input.persistenceShare // 0–1 share of indicators elevated
 * @param {string | null} [input.priorRegime]
 * @param {number} [input.confirmLeft] // hysteresis counter
 */
export function classifyRegime(input) {
  const {
    cci,
    cciMomentum,
    worseningCount,
    indicatorCount,
    persistenceShare,
    priorRegime = null,
  } = input

  if (cci == null || !Number.isFinite(cci)) {
    return {
      regime: null,
      status: "NOT_CLASSABLE",
      reasons: ["cci_unavailable"],
      confirmRequired: true,
    }
  }

  const mom = cciMomentum ?? 0
  const breadth =
    indicatorCount > 0 ? worseningCount / indicatorCount : 0
  const persist = persistenceShare ?? 0

  /** @type {string} */
  let regime = "Expansion"
  /** @type {string[]} */
  const reasons = []

  if (cci >= 80 && (mom > 0 || breadth >= 0.5)) {
    regime = "Crisis"
    reasons.push("cci_extreme", "stress_breadth_or_rising")
  } else if (cci >= 60 && mom > 0 && breadth >= 0.4) {
    regime = "Tightening"
    reasons.push("cci_elevated", "positive_momentum", "broad_worsening")
  } else if (cci >= 45 && mom > 2 && persist < 0.4) {
    regime = "Overheating"
    reasons.push("rising_from_mid", "persistence_not_entrenched")
  } else if (cci <= 45 && mom < -1 && priorRegime && ["Crisis", "Tightening"].includes(priorRegime)) {
    regime = "Recovery"
    reasons.push("declining_from_stress", "prior_stress_regime")
  } else if (cci < 40 && mom <= 0) {
    regime = "Expansion"
    reasons.push("low_cci", "non_rising")
  } else if (cci >= 50 && mom > 0) {
    regime = "Tightening"
    reasons.push("mid_high_cci_rising")
  } else if (cci >= 40) {
    regime = "Overheating"
    reasons.push("mid_cci_watch")
  } else {
    regime = "Expansion"
    reasons.push("default_expansion")
  }

  // Simple confirmation: if flipping vs prior, mark needs_confirm
  const flipping = priorRegime && priorRegime !== regime
  return {
    regime,
    status: flipping ? "PENDING_CONFIRM" : "OK",
    reasons,
    evidence: {
      cci,
      cciMomentum: mom,
      worseningBreadth: breadth,
      persistenceShare: persist,
      priorRegime,
    },
    bandsAreHypothesis: true,
  }
}

/**
 * Apply one-step confirmation hysteresis.
 * @param {string | null} pending
 * @param {string | null} proposed
 * @param {string | null} active
 * @param {number} streak
 */
export function confirmRegimeTransition(pending, proposed, active, streak) {
  if (!proposed) return { active, pending: null, streak: 0 }
  if (proposed === active) return { active, pending: null, streak: 0 }
  if (proposed === pending) {
    const next = streak + 1
    if (next >= 2) return { active: proposed, pending: null, streak: 0 }
    return { active, pending: proposed, streak: next }
  }
  return { active, pending: proposed, streak: 1 }
}
