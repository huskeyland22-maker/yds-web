import { clampScore } from "./seriesMath.js"

/** CORE — Bond/유동성 보조 (비중 축소) */
const CORE_KEYS = ["US10Y", "US30Y", "DXY"]
/** Expert — 기본 접힘, 낮은 가중 */
const EXPERT_KEYS = ["REAL_YIELD", "US2Y", "BEI"]

const TIER_WEIGHTS = {
  US10Y: 45,
  US30Y: 30,
  DXY: 25,
  REAL_YIELD: 40,
  US2Y: 30,
  BEI: 30,
}

const METRIC_MAX_POINTS = {
  US10Y: 20,
  REAL_YIELD: 12,
  US30Y: 10,
  BEI: 10,
  DXY: 10,
  US2Y: 8,
}

const CORE_CAP = 55
const EXPERT_CAP = 45
/** 보조 레이어 상한 — Cycle이 최종 판단 */
const BOND_LAYER_CAP = 55

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
  let coreRaw = 0
  let expertRaw = 0

  for (const key of CORE_KEYS) {
    const unit = metricRiskUnit(key, normalized[key])
    coreRaw += unit * (TIER_WEIGHTS[key] / 100)
  }
  for (const key of EXPERT_KEYS) {
    const unit = metricRiskUnit(key, normalized[key])
    expertRaw += unit * (TIER_WEIGHTS[key] / 100)
  }

  const extremeAll = isAllExtreme(normalized)
  const coreWeighted = extremeAll ? coreRaw : Math.min(coreRaw, CORE_CAP)
  const expertWeighted = extremeAll ? expertRaw : Math.min(expertRaw, EXPERT_CAP)
  const base = coreWeighted * 0.78 + expertWeighted * 0.22
  const triggerBoost =
    triggers.reduce((acc, t) => acc + (t.active ? Number(t.scoreAdd ?? 0) : 0), 0) * 0.55
  const unclamped = base + triggerBoost
  const score = extremeAll ? clampScore(unclamped) : Math.min(clampScore(unclamped), BOND_LAYER_CAP)

  return {
    score,
    tier1Score: clampScore(coreWeighted),
    tier2Score: clampScore(expertWeighted),
    band: scoreBand(score),
    breakdown: buildScoreBreakdown(normalized, triggers, {
      score,
      tier1Score: clampScore(coreWeighted),
      tier2Score: clampScore(expertWeighted),
      base,
      triggerBoost,
      extremeAll,
      rawTier1: Number(coreRaw.toFixed(2)),
      rawTier2: Number(expertRaw.toFixed(2)),
    }),
  }
}

/** @param {number} score */
export function scoreBand(score) {
  if (score <= 30) return "안정"
  if (score <= 45) return "주의"
  if (score <= 55) return "경계"
  return "경계"
}

/**
 * @param {Record<string, import('./normalizeLayer.js').NormalizedMetric>} normalized
 */
export function buildCompatPillars(normalized) {
  const rate = Math.round(
    (metricRiskUnit("US10Y", normalized.US10Y) +
      metricRiskUnit("US2Y", normalized.US2Y) +
      metricRiskUnit("US30Y", normalized.US30Y)) /
      3,
  )
  const inflation = Math.round((metricRiskUnit("BEI", normalized.BEI) + metricRiskUnit("US30Y", normalized.US30Y)) / 2)
  const liquidity = Math.round(metricRiskUnit("DXY", normalized.DXY))

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
  const allKeys = [...CORE_KEYS, ...EXPERT_KEYS]
  const metricRows = allKeys.map((key) => {
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
    { label: "2Y", points: byKey.US2Y?.score ?? 0 },
    { label: "이벤트", points: eventRate },
  ]
  const inflationItems = [
    { label: "30Y", points: byKey.US30Y?.score ?? 0 },
    { label: "BEI", points: byKey.BEI?.score ?? 0 },
    { label: "이벤트", points: eventInflation },
  ]
  const liquidityItems = [{ label: "DXY", points: byKey.DXY?.score ?? 0 }]

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
      {
        id: "events",
        title: "이벤트",
        items: activeEvents.map((e) => ({ label: e.label ?? e.id, points: Number(e.scoreAdd ?? 0) })),
        total: eventTotal,
      },
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
    Number(normalized.US30Y?.delta20D) >= 0.35 &&
    Number(normalized.DXY?.delta20D) >= 2.2 &&
    Number(normalized.BEI?.delta20D) >= 0.2
  )
}
