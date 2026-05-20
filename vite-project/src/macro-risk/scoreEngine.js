import { clampScore } from "./seriesMath.js"

const TIER_WEIGHTS = {
  US10Y: 25,
  REAL_YIELD: 20,
  DXY: 15,
  MOVE: 10,
  US30Y: 10,
  BEI: 10,
  VXN: 5,
  US2Y: 5,
}

const TIER1_KEYS = ["US10Y", "REAL_YIELD", "DXY", "MOVE"]
const TIER2_KEYS = ["US30Y", "BEI", "VXN", "US2Y"]

/**
 * @param {number|null} v
 * @param {number} min
 * @param {number} max
 */
function scale(v, min, max) {
  if (!Number.isFinite(Number(v))) return 0
  const n = Number(v)
  if (n <= min) return 0
  if (n >= max) return 100
  return ((n - min) / (max - min)) * 100
}

/**
 * @param {string} key
 * @param {import('./normalizeLayer.js').NormalizedMetric | undefined} m
 */
function metricRiskUnit(key, m) {
  if (!m) return 0
  const d20 = m.delta20D
  switch (key) {
    case "US10Y":
      return scale(d20, 0.02, 0.35)
    case "REAL_YIELD":
      return scale(d20, 0.01, 0.25)
    case "DXY":
      return scale(d20, 0.1, 3.2)
    case "MOVE":
      return scale(d20, 0.5, 18)
    case "US30Y":
      return scale(d20, 0.02, 0.35)
    case "BEI":
      return scale(d20, 0.01, 0.2)
    case "VXN":
      return scale(m.current, 14, 30)
    case "US2Y":
      return scale(d20, 0.02, 0.4)
    default:
      return 0
  }
}

/**
 * @param {Record<string, import('./normalizeLayer.js').NormalizedMetric>} normalized
 * @param {{ id: string; active: boolean; scoreAdd?: number }[]} triggers
 */
export function computeMacroRiskScore(normalized, triggers) {
  let tier1Weighted = 0
  let tier2Weighted = 0

  for (const key of TIER1_KEYS) {
    const unit = metricRiskUnit(key, normalized[key])
    tier1Weighted += unit * (TIER_WEIGHTS[key] / 70)
  }
  for (const key of TIER2_KEYS) {
    const unit = metricRiskUnit(key, normalized[key])
    tier2Weighted += unit * (TIER_WEIGHTS[key] / 30)
  }

  const base = tier1Weighted * 0.7 + tier2Weighted * 0.3
  const triggerBoost = triggers.reduce((acc, t) => acc + (t.active ? Number(t.scoreAdd ?? 0) : 0), 0)
  const score = clampScore(base + triggerBoost)

  return {
    score,
    tier1Score: clampScore(tier1Weighted),
    tier2Score: clampScore(tier2Weighted),
    band: scoreBand(score),
  }
}

/** @param {number} score */
export function scoreBand(score) {
  if (score <= 30) return "안정"
  if (score <= 60) return "주의"
  if (score <= 80) return "경계"
  return "위험"
}

/**
 * 기존 UI 칩 호환용 3개 pillar 점수로 매핑.
 * @param {Record<string, import('./normalizeLayer.js').NormalizedMetric>} normalized
 */
export function buildCompatPillars(normalized) {
  const rate = Math.round(
    (metricRiskUnit("US10Y", normalized.US10Y) +
      metricRiskUnit("REAL_YIELD", normalized.REAL_YIELD) +
      metricRiskUnit("US2Y", normalized.US2Y) +
      metricRiskUnit("US30Y", normalized.US30Y)) /
      4,
  )
  const inflation = Math.round((metricRiskUnit("BEI", normalized.BEI) + metricRiskUnit("US30Y", normalized.US30Y)) / 2)
  const liquidity = Math.round((metricRiskUnit("DXY", normalized.DXY) + metricRiskUnit("MOVE", normalized.MOVE)) / 2)

  return {
    rate: clampScore(rate),
    inflation: clampScore(inflation),
    liquidity: clampScore(liquidity),
  }
}
