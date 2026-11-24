import { INDICATOR_CONFIG, CCI_POLICY } from "./config.js"

/**
 * Weight scenarios — research hypotheses only, not optimized fits.
 * @typedef {Record<string, number>} WeightMap
 */

/** @type {Record<string, { label: string, mode: 'research'|'license_safe', weights: WeightMap }>} */
export const WEIGHT_SCENARIOS = {
  baseline_research: {
    label: "Baseline research (incl. HY/BBB hypothesis)",
    mode: "research",
    weights: {
      hy: 0.2,
      bbb: 0.15,
      sloos: 0.2,
      cpff: 0.1,
      bank: 0.1,
      cre: 0.1,
      corp_delinq: 0.15,
    },
  },
  license_safe_renorm: {
    label: "License-safe (HY/BBB removed, remaining renormalized)",
    mode: "license_safe",
    weights: {
      sloos: 0.2 / 0.65,
      cpff: 0.1 / 0.65,
      bank: 0.1 / 0.65,
      cre: 0.1 / 0.65,
      corp_delinq: 0.15 / 0.65,
    },
  },
  bank_heavy: {
    label: "Bank soundness heavier (license-safe family)",
    mode: "license_safe",
    weights: {
      sloos: 0.18,
      cpff: 0.1,
      bank: 0.22,
      cre: 0.1,
      corp_delinq: 0.15,
    },
  },
  sloos_heavy: {
    label: "SLOOS heavier (license-safe family)",
    mode: "license_safe",
    weights: {
      sloos: 0.3,
      cpff: 0.1,
      bank: 0.1,
      cre: 0.1,
      corp_delinq: 0.15,
    },
  },
  cre_corp_tilt: {
    label: "CRE + corp delinq tilt (license-safe family)",
    mode: "license_safe",
    weights: {
      sloos: 0.15,
      cpff: 0.1,
      bank: 0.1,
      cre: 0.18,
      corp_delinq: 0.22,
    },
  },
}

/**
 * Apply custom weights to scored components without mutating global config.
 * Uses partial CCI convention: Σ score*w / Σ w_scenario.
 *
 * @param {Array<{ id: string, score: number | null, quality?: string }>} scores
 * @param {WeightMap} weights
 * @param {{ asOfDate: string, pitStatus?: string }} meta
 */
export function computeCciWithWeights(scores, weights, meta) {
  const ids = Object.keys(weights)
  const byId = new Map(scores.map((s) => [s.id, s]))
  let totalW = 0
  let availW = 0
  let sum = 0
  const missing = []
  const components = []

  for (const id of ids) {
    const w = weights[id]
    totalW += w
    const got = byId.get(id)
    const score = got?.score ?? null
    const quality = got?.quality ?? (score == null ? "MISSING" : "VALID")
    components.push({ id, weightNominal: w, score, quality })
    if (score == null || !Number.isFinite(score)) {
      missing.push(id)
      continue
    }
    availW += w
    sum += score * w
  }

  const coverage = totalW > 0 ? availW / totalW : 0
  const missingShare = totalW > 0 ? (totalW - availW) / totalW : 1
  const hold = coverage < CCI_POLICY.coverageHoldBelow
  const cciPartial = totalW > 0 ? Math.round((sum / totalW) * 10) / 10 : null

  return {
    asOfDate: meta.asOfDate,
    pitValidationStatus: meta.pitStatus ?? "UNSPECIFIED",
    cci: hold ? null : cciPartial,
    cciPartial,
    cciRenormalized: availW > 0 ? Math.round((sum / availW) * 10) / 10 : null,
    cciStatus: hold ? "HOLD_LOW_COVERAGE" : cciPartial == null ? "UNAVAILABLE" : "OK",
    coverage,
    missingShare,
    confidence: hold
      ? "HOLD"
      : missingShare > CCI_POLICY.missingWeightWarnAbove
        ? "LOW"
        : "HIGH",
    missingIndicators: missing,
    components,
    weightsAreHypothesis: true,
  }
}

/**
 * Run weight scenarios over a path of pre-scored indicator sets.
 * @param {Array<{ asOfDate: string, scores: Array<{id:string,score:number|null,quality?:string}>, pitStatus?: string }>} path
 */
export function runWeightSensitivity(path) {
  /** @type {Record<string, object>} */
  const out = {}
  for (const [key, scen] of Object.entries(WEIGHT_SCENARIOS)) {
    const rows = path.map((p) => {
      const filteredScores =
        scen.mode === "license_safe"
          ? p.scores.filter((s) => s.id !== "hy" && s.id !== "bbb")
          : p.scores
      const cci = computeCciWithWeights(filteredScores, scen.weights, {
        asOfDate: p.asOfDate,
        pitStatus: p.pitStatus,
      })
      return {
        asOfDate: p.asOfDate,
        cci: cci.cci,
        coverage: cci.coverage,
        confidence: cci.confidence,
        status: cci.cciStatus,
      }
    })
    const classable = rows.filter((r) => r.cci != null)
    const peak = classable.reduce(
      (a, b) => (a == null || (b.cci ?? -1) > (a.cci ?? -1) ? b : a),
      null,
    )
    out[key] = {
      label: scen.label,
      mode: scen.mode,
      weights: scen.weights,
      peak,
      classablePoints: classable.length,
      path: rows,
    }
  }
  return out
}

/**
 * Regime confirmation sensitivity: confirmSteps = 1 (fast) vs 2 (baseline) vs 3 (conservative).
 * @param {Array<{ asOfDate: string, proposed: string | null }>} proposals
 * @param {number} confirmSteps
 */
export function runRegimeConfirmSensitivity(proposals, confirmSteps) {
  let active = null
  let pending = null
  let streak = 0
  /** @type {object[]} */
  const path = []
  for (const p of proposals) {
    if (!p.proposed) {
      path.push({ asOfDate: p.asOfDate, active, pending, streak, event: "skip" })
      continue
    }
    if (p.proposed === active) {
      pending = null
      streak = 0
      path.push({ asOfDate: p.asOfDate, active, pending, streak, event: "hold" })
      continue
    }
    if (p.proposed === pending) {
      streak += 1
      if (streak >= confirmSteps) {
        active = p.proposed
        pending = null
        streak = 0
        path.push({
          asOfDate: p.asOfDate,
          active,
          pending,
          streak,
          event: "confirm_switch",
        })
      } else {
        path.push({
          asOfDate: p.asOfDate,
          active,
          pending,
          streak,
          event: "pending",
        })
      }
    } else {
      pending = p.proposed
      streak = 1
      if (confirmSteps <= 1) {
        active = p.proposed
        pending = null
        streak = 0
        path.push({
          asOfDate: p.asOfDate,
          active,
          pending,
          streak,
          event: "fast_switch",
        })
      } else {
        path.push({
          asOfDate: p.asOfDate,
          active,
          pending,
          streak,
          event: "new_pending",
        })
      }
    }
  }
  const switches = path.filter((r) =>
    ["confirm_switch", "fast_switch"].includes(r.event),
  ).length
  return { confirmSteps, switches, path }
}

export function listBaselineIds() {
  return INDICATOR_CONFIG.map((c) => c.id)
}
