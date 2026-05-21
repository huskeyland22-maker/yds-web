/**
 * YDS Slope Engine — 1D / 5D / 20D → 안정·상승·급등·쇼크
 */
import { absDelta, lastFinite, valueAtOffset } from "../macro-risk/seriesMath.js"
import { inferDeltaMethod, formatDeltaByMethod } from "../macro-risk/deltaSemantics.js"
import { SLOPE_STATE_LABEL, SLOPE_THRESHOLDS } from "./ydsScoreExplainConfig.js"

/** @typedef {import('./ydsScoreExplainConfig.js').SlopeKind} SlopeKind */

/** @typedef {'stable'|'rise'|'surge'|'shock'} SlopeState */

/**
 * @typedef {{
 *   d1: number | null
 *   d5: number | null
 *   d20: number | null
 *   d1Pct: number | null
 *   d5Pct: number | null
 *   d20Pct: number | null
 * }} SlopeDeltas
 */

/**
 * @param {number[]} values
 * @returns {SlopeDeltas}
 */
export function computeSlopeDeltas(values) {
  const current = lastFinite(values)
  const prev1 = valueAtOffset(values, 1)
  const prev5 = valueAtOffset(values, 5)
  const prev20 = valueAtOffset(values, 20)

  const d1 = absDelta(prev1, current)
  const d5 = absDelta(prev5, current)
  const d20 = absDelta(prev20, current)

  const pct = (from, to) => {
    if (!Number.isFinite(from) || !Number.isFinite(to) || Math.abs(from) < 1e-9) return null
    return ((to - from) / Math.abs(from)) * 100
  }

  return {
    d1,
    d5,
    d20,
    d1Pct: pct(prev1, current),
    d5Pct: pct(prev5, current),
    d20Pct: pct(prev20, current),
  }
}

/**
 * @param {SlopeKind} kind
 * @param {SlopeDeltas} deltas
 * @param {{ higherHurts?: boolean }} [opts]
 * @returns {{ state: SlopeState; warn: boolean }}
 */
export function classifySlopeState(kind, deltas, opts = {}) {
  const th = SLOPE_THRESHOLDS[kind] ?? SLOPE_THRESHOLDS.level
  const higherHurts = opts.higherHurts !== false

  const pick = deltas.d5 ?? deltas.d1
  const pickPct = deltas.d5Pct ?? deltas.d1Pct

  let magnitude = 0
  if (pickPct != null && Number.isFinite(pickPct)) {
    magnitude = Math.abs(pickPct)
  } else if (pick != null && Number.isFinite(pick)) {
    magnitude = Math.abs(pick)
  }

  let state = /** @type {SlopeState} */ ("stable")
  if (magnitude >= th.shock5) state = "shock"
  else if (magnitude >= th.surge5) state = "surge"
  else if (magnitude >= th.stable5) state = "rise"

  if (pick != null && pick !== 0) {
    const up = pick > 0
    const bad = higherHurts ? up : !up
    if (state === "stable" && Math.abs(pick) >= th.stable5 * 0.6) {
      state = bad ? "rise" : "stable"
    }
  }

  return { state, warn: state === "surge" || state === "shock" }
}

/**
 * @param {string} key
 * @param {SlopeKind} kind
 * @param {number | null} current
 * @param {SlopeDeltas} deltas
 */
export function formatHorizonDelta(key, kind, current, deltas) {
  const fmt = kind === "rate" || kind === "spread" ? "rate" : kind === "level" ? "level" : "index"
  const lines = []

  if (deltas.d1 != null) {
    const method = inferDeltaMethod(key, current, deltas.d1, "1D")
    lines.push(`1D: ${formatDeltaByMethod(deltas.d1, method, fmt)}`)
  }
  if (deltas.d5 != null) {
    const method = inferDeltaMethod(key, current, deltas.d5, "5D")
    lines.push(`5D: ${formatDeltaByMethod(deltas.d5, method, fmt)}`)
  }
  if (deltas.d20 != null) {
    const method = inferDeltaMethod(key, current, deltas.d20, "20D")
    lines.push(`20D: ${formatDeltaByMethod(deltas.d20, method, fmt)}`)
  }

  return lines
}

/**
 * @param {SlopeDeltas} deltas
 * @param {SlopeState} state
 * @param {{ higherHurts?: boolean }} [opts]
 * @returns {string[]}
 */
export function buildSlopeSummaryLines(deltas, state, opts = {}) {
  const higherHurts = opts.higherHurts !== false
  const lines = []

  const label5 = slopeMoveLabel(deltas.d5, deltas.d5Pct, "5D", higherHurts)
  const label20 = slopeMoveLabel(deltas.d20, deltas.d20Pct, "20D", higherHurts)

  if (label5) lines.push(label5)
  if (label20 && label20 !== label5) lines.push(label20)
  if (!lines.length) lines.push(SLOPE_STATE_LABEL[state] ?? "안정")

  if (state === "surge" || state === "shock") lines.push("경고")

  return lines
}

/**
 * @param {number|null} delta
 * @param {number|null} pct
 * @param {'5D'|'20D'} tag
 * @param {boolean} higherHurts
 */
function slopeMoveLabel(delta, pct, tag, higherHurts) {
  if (delta == null && pct == null) return null
  const n = pct != null && Math.abs(pct) >= 0.5 ? pct : delta
  if (n == null || !Number.isFinite(n)) return `${tag} ${SLOPE_STATE_LABEL.stable}`

  if (Math.abs(n) < 2) return `${tag} ${SLOPE_STATE_LABEL.stable}`

  const up = n > 0
  if (up) {
    if (Math.abs(n) >= 18) return `${tag} ${SLOPE_STATE_LABEL.shock}`
    if (Math.abs(n) >= 8) return `${tag} ${SLOPE_STATE_LABEL.surge}`
    return `${tag} ${higherHurts ? SLOPE_STATE_LABEL.rise : "개선"}`
  }

  if (Math.abs(n) >= 12) return `${tag} ${higherHurts ? "급락" : SLOPE_STATE_LABEL.shock}`
  if (Math.abs(n) >= 5) return `${tag} 하락`
  return `${tag} ${higherHurts ? "완화" : "개선"}`
}

/** @param {'stable'|'rise'|'surge'|'shock'} state @returns {'positive'|'neutral'|'warning'|'shock'} */
export function slopeToneFromState(state) {
  if (state === "shock") return "shock"
  if (state === "surge") return "warning"
  if (state === "rise") return "warning"
  return "neutral"
}

/** @param {number} points @returns {'positive'|'neutral'|'warning'|'shock'} */
export function toneFromContribution(points) {
  if (points <= -6) return "shock"
  if (points < 0) return "warning"
  if (points >= 6) return "positive"
  return "neutral"
}
