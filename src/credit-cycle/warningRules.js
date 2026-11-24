/**
 * Candidate credit-risk warning ladder — research validation only.
 * Distinct from Expansion/Overheating/Tightening/Crisis/Recovery regimes.
 *
 * Does NOT mutate CCI engine weights.
 */

import { CCI_POLICY } from "./config.js"
import { runRegimeConfirmSensitivity } from "./sensitivity.js"

/** @typedef {'NORMAL'|'WATCH'|'WARNING'|'HIGH_RISK'|'HOLD'} WarningLevel */

/**
 * @param {object} row
 * @param {number | null} row.cci
 * @param {number | null} [row.cciMomentum]
 * @param {number} [row.coverage]
 * @param {string} [row.cciStatus]
 * @param {string} [row.confidence]
 * @param {number} [row.elevatedCount] indicators with score >= 60
 * @param {number} [row.available]
 * @param {{
 *   cciWatch: number,
 *   cciWarning: number,
 *   cciHigh: number,
 *   requireMomentum?: boolean,
 *   momentumMin?: number,
 *   requirePersistenceBreadth?: boolean,
 *   minElevated?: number,
 *   coverageHoldBelow?: number,
 * }} rule
 * @returns {{ level: WarningLevel, reasons: string[] }}
 */
export function classifyWarningLevel(row, rule) {
  const reasons = []
  const coverageHold = rule.coverageHoldBelow ?? CCI_POLICY.coverageHoldBelow

  if (
    row.cci == null ||
    row.cciStatus === "HOLD_LOW_COVERAGE" ||
    (row.coverage != null && row.coverage < coverageHold) ||
    row.confidence === "HOLD"
  ) {
    return { level: "HOLD", reasons: ["insufficient_coverage_or_cci"] }
  }

  const mom = row.cciMomentum
  const elevated = row.elevatedCount ?? 0
  const available = row.available ?? 0

  if (rule.requireMomentum && (mom == null || mom < (rule.momentumMin ?? 0))) {
    // Momentum gate: cannot reach WARNING/HIGH without rising CCI
    if (row.cci >= rule.cciWatch) {
      reasons.push("momentum_gate_caps_at_watch")
      return { level: "WATCH", reasons: ["cci_above_watch", ...reasons] }
    }
    return { level: "NORMAL", reasons: ["below_watch_or_flat"] }
  }

  if (rule.requirePersistenceBreadth) {
    const need = rule.minElevated ?? 2
    if (elevated < need) {
      if (row.cci >= rule.cciWatch) {
        return {
          level: "WATCH",
          reasons: ["cci_elevated_but_breadth_thin", `elevated=${elevated}`],
        }
      }
      return { level: "NORMAL", reasons: ["breadth_and_cci_low"] }
    }
  }

  if (row.cci >= rule.cciHigh) {
    reasons.push("cci_high_risk_band")
    if (rule.requireMomentum && mom != null && mom > 0) reasons.push("momentum_up")
    return { level: "HIGH_RISK", reasons }
  }
  if (row.cci >= rule.cciWarning) {
    reasons.push("cci_warning_band")
    return { level: "WARNING", reasons }
  }
  if (row.cci >= rule.cciWatch) {
    reasons.push("cci_watch_band")
    return { level: "WATCH", reasons }
  }
  return { level: "NORMAL", reasons: ["below_watch"], available }
}

/**
 * Map a single CCI threshold "warn if cci >= T" into the ladder
 * (WATCH=T-10 floored, WARNING=T, HIGH=T+10 capped) for sensitivity grid.
 * @param {number} warnThreshold
 */
export function ruleFromWarnThreshold(warnThreshold, extras = {}) {
  return {
    cciWatch: Math.max(0, warnThreshold - 10),
    cciWarning: warnThreshold,
    cciHigh: Math.min(100, warnThreshold + 10),
    requireMomentum: !!extras.requireMomentum,
    momentumMin: extras.momentumMin ?? 0,
    requirePersistenceBreadth: !!extras.requirePersistenceBreadth,
    minElevated: extras.minElevated ?? 2,
    coverageHoldBelow: extras.coverageHoldBelow ?? CCI_POLICY.coverageHoldBelow,
  }
}

/**
 * Apply warning levels across a path; optional confirmSteps for WARNING+ sticky confirm.
 * @param {Array<object>} pathRows must include asOf, cci, ...
 * @param {object} rule
 * @param {number} [confirmSteps] for escalating to WARNING/HIGH_RISK
 */
export function applyWarningPath(pathRows, rule, confirmSteps = 1) {
  /** @type {Array<object>} */
  const out = []
  let pending = null
  let streak = 0
  /** @type {WarningLevel | null} */
  let active = null

  for (const row of pathRows) {
    if (row.status === "NOT_TESTABLE" || row.pit === "NOT_TESTABLE") {
      out.push({
        asOf: row.asOf,
        level: "HOLD",
        proposed: "HOLD",
        active: active ?? "HOLD",
        reasons: ["not_testable"],
        cci: null,
      })
      continue
    }

    const { level: proposed, reasons } = classifyWarningLevel(row, rule)
    let confirmed = proposed

    // Confirm only for WARNING / HIGH_RISK escalations (not NORMAL/WATCH flicker)
    const escalating =
      (proposed === "WARNING" || proposed === "HIGH_RISK") &&
      proposed !== active

    if (confirmSteps <= 1 || !escalating) {
      active = proposed
      pending = null
      streak = 0
      confirmed = proposed
    } else if (proposed === pending) {
      streak += 1
      if (streak >= confirmSteps) {
        active = proposed
        pending = null
        streak = 0
        confirmed = proposed
      } else {
        confirmed = active ?? "WATCH"
      }
    } else {
      pending = proposed
      streak = 1
      confirmed = active ?? "WATCH"
    }

    out.push({
      asOf: row.asOf,
      level: confirmed,
      proposed,
      active,
      pending,
      streak,
      reasons,
      cci: row.cci,
      cciMomentum: row.cciMomentum,
      coverage: row.coverage,
      confidence: row.confidence,
    })
  }
  return out
}

/**
 * Evaluate warnings vs an event date. Pre vs post strictly separated.
 *
 * @param {Array<{ asOf: string, level: string, cci: number | null }>} warnPath
 * @param {string} eventDate
 * @param {string[]} alertLevels levels counting as "on alert"
 */
export function evaluateWarningPerformance(warnPath, eventDate, alertLevels = ["WARNING", "HIGH_RISK"]) {
  if (!eventDate) {
    return { status: "NOT_EVALUATED", reason: "no_event_date" }
  }

  const pre = warnPath.filter((r) => r.asOf < eventDate)
  const post = warnPath.filter((r) => r.asOf >= eventDate)

  if (pre.length < 1) {
    return {
      status: "NOT_EVALUATED",
      reason: "no_pre_event_asof_points_on_path",
      eventDate,
      postAlertCount: post.filter((r) => alertLevels.includes(r.level)).length,
      note: "Quarterly PIT path may start after the event anchor — cannot claim lead time.",
    }
  }

  const preAlerts = pre.filter((r) => alertLevels.includes(r.level))
  const postAlerts = post.filter((r) => alertLevels.includes(r.level))
  const firstPre = preAlerts[0] ?? null
  const firstAny = warnPath.find((r) => alertLevels.includes(r.level)) ?? null

  let leadDays = null
  if (firstPre) {
    leadDays = Math.round(
      (Date.parse(eventDate) - Date.parse(firstPre.asOf)) / 86400000,
    )
  }

  // False alarms: alert on pre path more than 365d before event (loose research def)
  const earlyFa = preAlerts.filter((r) => {
    const d = (Date.parse(eventDate) - Date.parse(r.asOf)) / 86400000
    return d > 365
  })

  // Miss: no pre-event alert
  const missedPre = preAlerts.length === 0

  // Clear: first return to NORMAL after peak alert in post
  let clearAsOf = null
  let seenAlert = false
  for (const r of warnPath) {
    if (alertLevels.includes(r.level)) seenAlert = true
    if (seenAlert && r.level === "NORMAL" && r.asOf >= eventDate) {
      clearAsOf = r.asOf
      break
    }
  }

  return {
    status: "COMPUTED",
    eventDate,
    prePoints: pre.length,
    postPoints: post.length,
    preAlertCount: preAlerts.length,
    postAlertCount: postAlerts.length,
    firstPreAlert: firstPre,
    firstAlertAny: firstAny,
    firstAlertIsPostEvent: firstAny ? firstAny.asOf >= eventDate : null,
    leadDays,
    leadMonthsApprox: leadDays == null ? null : Math.round((leadDays / 30) * 10) / 10,
    falseAlarmsBeyond1yPre: earlyFa.length,
    missedPreEventWarning: missedPre,
    clearAsOf,
    alertLevels,
  }
}

/**
 * Regime-confirm sensitivity helper re-export for warning docs.
 */
export { runRegimeConfirmSensitivity }
