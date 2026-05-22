/**
 * YDS Slope Engine — 5D / 20D 방향 기울기 (숫자 델타 UI 금지)
 */
import { absDelta, lastFinite, valueAtOffset } from "../macro-risk/seriesMath.js"
import { SLOPE_STATE_LABEL, SLOPE_THRESHOLDS } from "./ydsScoreExplainConfig.js"

/** @typedef {import('./ydsScoreExplainConfig.js').SlopeKind} SlopeKind */

/** @typedef {'stable'|'rise'|'surge'|'shock'} SlopeState */

/** @typedef {'up'|'down'|'stable'} SlopeDirection */

/**
 * @typedef {{
 *   horizon: '5D' | '20D'
 *   direction: SlopeDirection
 *   label: string
 *   tone: 'positive' | 'neutral' | 'risk'
 * }} SlopeDirectionItem
 */

const DIRECTION_LABEL = Object.freeze({
  up: "상승",
  down: "하락",
  stable: "안정",
})

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

  const d1 = signedDelta(prev1, current)
  const d5 = signedDelta(prev5, current)
  const d20 = signedDelta(prev20, current)

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

function signedDelta(from, to) {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null
  return to - from
}

/**
 * @param {number | null} delta
 * @param {number} threshold
 * @returns {{ direction: SlopeDirection; tone: 'positive' | 'neutral' | 'risk' }}
 */
export function classifySlopeDirection(delta, threshold) {
  if (delta == null || !Number.isFinite(delta) || threshold <= 0) {
    return { direction: "stable", tone: "neutral" }
  }
  if (Math.abs(delta) < threshold) {
    return { direction: "stable", tone: "neutral" }
  }
  if (delta > 0) {
    return { direction: "up", tone: "positive" }
  }
  return { direction: "down", tone: "risk" }
}

/**
 * @param {SlopeDeltas} deltas
 * @param {SlopeKind} kind
 * @returns {SlopeDirectionItem[]}
 */
export function buildSlopeDirectionItems(deltas, kind) {
  const th = SLOPE_THRESHOLDS[kind] ?? SLOPE_THRESHOLDS.level
  const threshold = th.stable5
  /** @type {SlopeDirectionItem[]} */
  const items = []

  for (const { horizon, key, pctKey } of [
    { horizon: /** @type {'5D'} */ ("5D"), key: "d5", pctKey: "d5Pct" },
    { horizon: /** @type {'20D'} */ ("20D"), key: "d20", pctKey: "d20Pct" },
  ]) {
    let delta = deltas[key]
    if ((delta == null || !Number.isFinite(delta)) && deltas[pctKey] != null) {
      delta = deltas[pctKey]
    }
    if (delta == null && deltas[pctKey] == null) continue

    const { direction, tone } = classifySlopeDirection(delta, threshold)
    items.push({
      horizon,
      direction,
      label: `${horizon} ${DIRECTION_LABEL[direction]}`,
      tone,
    })
  }

  if (!items.length) {
    items.push({
      horizon: "5D",
      direction: "stable",
      label: `5D ${DIRECTION_LABEL.stable}`,
      tone: "neutral",
    })
  }

  return items
}

/** @deprecated UI v1 — 문자열 요약 대신 buildSlopeDirectionItems 사용 */
export function buildSlopeSummaryLines(deltas, state, _opts = {}) {
  return buildSlopeDirectionItems(deltas, "level").map((i) => i.label)
}

/** @deprecated 숫자 델타 라인 UI 금지 */
export function formatHorizonDelta() {
  return []
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
