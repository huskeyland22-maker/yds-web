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
const METRIC_MAX_POINTS = {
  US10Y: 20,
  REAL_YIELD: 15,
  MOVE: 15,
  US30Y: 10,
  BEI: 10,
  DXY: 10,
}

const TIER1_CAP = 85
const TIER2_CAP = 70
const MACRO_CAP = 85

/**
 * @param {string} key
 * @param {import('./normalizeLayer.js').NormalizedMetric | undefined} m
 */
export function metricRiskUnit(key, m) {
  if (!m) return 0
  const d20 = m.delta20D
  switch (key) {
    case "US10Y":
      return bucketNormalized(d20, [
        [0.1, 20],
        [0.2, 40],
        [0.35, 60],
        [0.5, 80],
      ])
    case "REAL_YIELD":
      return bucketNormalized(d20, [
        [0.1, 20],
        [0.2, 40],
        [0.35, 70],
      ])
    case "DXY":
      return bucketNormalized(d20, [
        [0.5, 20],
        [1.2, 40],
        [2.2, 70],
      ])
    case "MOVE":
      return bucketNormalized(d20, [
        [20, 20],
        [40, 40],
        [60, 70],
      ])
    case "US30Y":
      return bucketNormalized(d20, [
        [0.1, 20],
        [0.2, 40],
        [0.35, 70],
      ])
    case "BEI":
      return bucketNormalized(d20, [
        [0.05, 20],
        [0.1, 40],
        [0.2, 70],
      ])
    case "VXN":
      return bucketNormalized(m.current, [
        [20, 20],
        [25, 40],
        [30, 70],
      ])
    case "US2Y":
      return bucketNormalized(d20, [
        [0.1, 20],
        [0.2, 40],
        [0.35, 70],
      ])
    default:
      return 0
  }
}

/**
 * @param {Record<string, import('./normalizeLayer.js').NormalizedMetric>} normalized
 * @param {{ id: string; active: boolean; scoreAdd?: number }[]} triggers
 */
export function computeMacroRiskScore(normalized, triggers) {
  let tier1WeightedRaw = 0
  let tier2WeightedRaw = 0

  for (const key of TIER1_KEYS) {
    const unit = metricRiskUnit(key, normalized[key])
    tier1WeightedRaw += unit * (TIER_WEIGHTS[key] / 70)
  }
  for (const key of TIER2_KEYS) {
    const unit = metricRiskUnit(key, normalized[key])
    tier2WeightedRaw += unit * (TIER_WEIGHTS[key] / 30)
  }

  const extremeAll = isAllExtreme(normalized)
  const tier1Weighted = extremeAll ? tier1WeightedRaw : Math.min(tier1WeightedRaw, TIER1_CAP)
  const tier2Weighted = extremeAll ? tier2WeightedRaw : Math.min(tier2WeightedRaw, TIER2_CAP)
  const base = tier1Weighted * 0.7 + tier2Weighted * 0.3
  const triggerBoost = triggers.reduce((acc, t) => acc + (t.active ? Number(t.scoreAdd ?? 0) : 0), 0)
  const unclamped = base + triggerBoost
  const score = extremeAll ? clampScore(unclamped) : Math.min(clampScore(unclamped), MACRO_CAP)

  return {
    score,
    tier1Score: clampScore(tier1Weighted),
    tier2Score: clampScore(tier2Weighted),
    band: scoreBand(score),
    breakdown: buildScoreBreakdown(normalized, triggers, {
      score,
      tier1Score: clampScore(tier1Weighted),
      tier2Score: clampScore(tier2Weighted),
      base,
      triggerBoost,
      extremeAll,
      rawTier1: Number(tier1WeightedRaw.toFixed(2)),
      rawTier2: Number(tier2WeightedRaw.toFixed(2)),
    }),
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

/**
 * @param {Record<string, import('./normalizeLayer.js').NormalizedMetric>} normalized
 * @param {{ id: string; label?: string; active: boolean; scoreAdd?: number }[]} triggers
 * @param {{ score: number; tier1Score: number; tier2Score: number; base: number; triggerBoost: number }} totals
 */
function buildScoreBreakdown(normalized, triggers, totals) {
  const metricRows = Object.keys(TIER_WEIGHTS).map((key) => {
    const m = normalized[key]
    const unit = metricRiskUnit(key, m)
    return {
      key,
      current: Number.isFinite(Number(m?.current)) ? Number(m.current) : null,
      delta1D: Number.isFinite(Number(m?.delta1D)) ? Number(m.delta1D) : null,
      delta5D: Number.isFinite(Number(m?.delta5D)) ? Number(m.delta5D) : null,
      delta20D: Number.isFinite(Number(m?.delta20D)) ? Number(m.delta20D) : null,
      raw: Number.isFinite(Number(m?.delta20D)) ? Number(m.delta20D) : null,
      normalized: Number(unit.toFixed(2)),
      score: metricContributionPoints(key, unit),
    }
  })
  const byKey = Object.fromEntries(metricRows.map((m) => [m.key, m]))
  const activeEvents = triggers.filter((t) => t.active)
  const eventRate = activeEvents
    .filter((t) => t.id === "rate_shock" || t.id === "rate_repricing_event")
    .reduce((acc, t) => acc + Number(t.scoreAdd ?? 0), 0)
  const eventInflation = activeEvents
    .filter((t) => t.id === "long_inflation" || t.id === "long_rate_stress")
    .reduce((acc, t) => acc + Number(t.scoreAdd ?? 0), 0)
  const eventTotal = activeEvents.reduce((acc, t) => acc + Number(t.scoreAdd ?? 0), 0)

  const rateItems = [
    { label: "10Y", points: byKey.US10Y?.score ?? 0 },
    { label: "REAL", points: byKey.REAL_YIELD?.score ?? 0 },
    { label: "MOVE", points: byKey.MOVE?.score ?? 0 },
    { label: "이벤트", points: eventRate },
  ]
  const inflationItems = [
    { label: "30Y", points: byKey.US30Y?.score ?? 0 },
    { label: "BEI", points: byKey.BEI?.score ?? 0 },
    { label: "이벤트", points: eventInflation },
  ]
  const liquidityItems = [
    { label: "DXY", points: byKey.DXY?.score ?? 0 },
    { label: "MOVE", points: Math.round((byKey.MOVE?.score ?? 0) / 3) },
  ]

  return {
    formula: {
      macro: Number(totals.score.toFixed(2)),
      tier1: Number(totals.tier1Score.toFixed(2)),
      tier2: Number(totals.tier2Score.toFixed(2)),
      base: Number(totals.base.toFixed(2)),
      events: Number(totals.triggerBoost.toFixed(2)),
    },
    sections: [
      { id: "rate", title: "금리압력", items: rateItems, total: sumPoints(rateItems) },
      { id: "inflation", title: "인플레압력", items: inflationItems, total: sumPoints(inflationItems) },
      { id: "liquidity", title: "유동성", items: liquidityItems, total: sumPoints(liquidityItems) },
      { id: "events", title: "이벤트", items: activeEvents.map((e) => ({ label: e.label ?? e.id, points: Number(e.scoreAdd ?? 0) })), total: eventTotal },
    ],
    metrics: metricRows,
  }
}

function metricContributionPoints(key, unit) {
  const max = METRIC_MAX_POINTS[key] ?? 0
  return Math.round((clampScore(unit) / 100) * max)
}

function sumPoints(items) {
  return items.reduce((acc, it) => acc + Number(it.points ?? 0), 0)
}

function bucketNormalized(value, bands) {
  if (!Number.isFinite(Number(value))) return 0
  const n = Number(value)
  for (let i = 0; i < bands.length; i += 1) {
    const [max, score] = bands[i]
    if (n <= max) return score
  }
  return 100
}

function isAllExtreme(normalized) {
  return (
    Number(normalized.US10Y?.delta20D) >= 0.5 &&
    Number(normalized.REAL_YIELD?.delta20D) >= 0.35 &&
    Number(normalized.MOVE?.delta20D) >= 60 &&
    Number(normalized.US30Y?.delta20D) >= 0.35 &&
    Number(normalized.BEI?.delta20D) >= 0.2
  )
}
