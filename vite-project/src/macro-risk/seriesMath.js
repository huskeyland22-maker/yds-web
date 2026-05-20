/** @param {number[]} values */
export function lastFinite(values) {
  if (!Array.isArray(values)) return null
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const n = Number(values[i])
    if (Number.isFinite(n)) return n
  }
  return null
}

/**
 * @param {number[]} values
 * @param {number} offset days back from last
 */
export function valueAtOffset(values, offset) {
  if (!Array.isArray(values) || offset < 0) return null
  const idx = values.length - 1 - offset
  if (idx < 0) return null
  const n = Number(values[idx])
  return Number.isFinite(n) ? n : null
}

/**
 * @param {number|null} from
 * @param {number|null} to
 */
export function absDelta(from, to) {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null
  return to - from
}

/**
 * @param {number[]} values
 * @returns {'up'|'down'|'flat'}
 */
export function slopeDirection(values) {
  const window = Array.isArray(values) ? values.slice(-20).filter((v) => Number.isFinite(Number(v))) : []
  if (window.length < 4) return "flat"
  const first = Number(window[0])
  const last = Number(window[window.length - 1])
  const d = last - first
  if (Math.abs(d) < 1e-6) return "flat"
  return d > 0 ? "up" : "down"
}

/**
 * @param {number[]} values
 * @param {number} lookback
 */
export function nearRecentHigh(values, lookback = 20) {
  const slice = Array.isArray(values) ? values.slice(-lookback).filter((v) => Number.isFinite(Number(v))) : []
  if (slice.length < 3) return false
  const last = Number(slice[slice.length - 1])
  const max = Math.max(...slice.map(Number))
  return last >= max * 0.97
}

/**
 * @param {'up'|'down'|'flat'} slope
 */
export function slopeArrow(slope) {
  if (slope === "up") return "↗"
  if (slope === "down") return "↘"
  return "→"
}

/**
 * @param {number|null} change
 * @param {'up'|'down'|'flat'} slope
 */
export function changeTag(change, slope) {
  if (change != null && change > 0.05) return "급등"
  if (change != null && change > 0.01) return "상승"
  if (change != null && change < -0.05) return "급락"
  if (change != null && change < -0.01) return "하락"
  if (slope === "up") return "상승"
  if (slope === "down") return "하락"
  return "보합"
}

export function clampScore(n) {
  return Math.min(100, Math.max(0, Math.round(n)))
}

/**
 * @param {number} score
 */
export function scoreEmoji(score) {
  if (score >= 70) return "🔴"
  if (score >= 50) return "🟠"
  return "🟡"
}
