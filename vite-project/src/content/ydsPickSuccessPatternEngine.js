/**
 * YDS 추천 성공 패턴 분석 — 실제 잠금 수익률만 사용 (AI 예측 없음)
 */

import {
  classifyPickOutcome,
  DEFAULT_OUTCOME_CRITERIA,
  outcomeCriteriaLabels,
  picksWithLockedOutcome,
} from "./ydsPickOutcomeEngine.js"
import { getRecommendSnapshot } from "./ydsValidationRecommendSnapshot.js"
import { PERF_HORIZONS } from "./ydsPickPerformanceEngine.js"
/** @typedef {import("./ydsValidationStorage.js").ValidationPickRecord} ValidationPickRecord */
/** @typedef {'d7' | 'd14' | 'd30'} PatternHorizonKey */
/** @typedef {'success' | 'normal' | 'failure'} OutcomeId */

export const PATTERN_MIN_SAMPLE = 10

/** @deprecated use DEFAULT_OUTCOME_CRITERIA */
export const SUCCESS_CRITERIA = {
  successMin: DEFAULT_OUTCOME_CRITERIA.successMinPct,
  normalMin: DEFAULT_OUTCOME_CRITERIA.failureMaxPct,
  failureMax: DEFAULT_OUTCOME_CRITERIA.failureMaxPct,
}

export const OUTCOME_LABELS = outcomeCriteriaLabels()

/** @param {number | null | undefined} returnPct @returns {OutcomeId | null} */
export function classifyOutcome(returnPct) {
  return classifyPickOutcome(returnPct, DEFAULT_OUTCOME_CRITERIA)
}

/** @param {ValidationPickRecord[]} picks @param {PatternHorizonKey} horizonKey */
export function picksWithLockedHorizon(picks, horizonKey) {
  return picksWithLockedOutcome(picks, horizonKey)
}

/** @type {{ id: string; label: string; min: number; max: number }[]} */
export const PANIC_BUCKETS = [
  { id: "p0", label: "0~20", min: 0, max: 20 },
  { id: "p20", label: "20~40", min: 20, max: 40 },
  { id: "p40", label: "40~60", min: 40, max: 60 },
  { id: "p60", label: "60~80", min: 60, max: 80 },
  { id: "p80", label: "80~100", min: 80, max: 100 },
]

/**
 * @typedef {{
 *   id: string
 *   label: string
 *   count: number
 *   successCount: number
 *   normalCount: number
 *   failureCount: number
 *   successRate: number | null
 *   avgReturn: number | null
 *   sufficient: boolean
 *   pending: boolean
 * }} PatternBucketStat
 */

/**
 * @typedef {{
 *   horizonKey: PatternHorizonKey
 *   horizonLabel: string
 *   totalTracked: number
 *   criteria: typeof DEFAULT_OUTCOME_CRITERIA
 *   highlights: PatternBucketStat[]
 *   grades: { quality: PatternBucketStat[]; timing: PatternBucketStat[]; marketFit: PatternBucketStat[] }
 *   marketStates: PatternBucketStat[]
 *   panicBands: PatternBucketStat[]
 * }} SuccessPatternReport
 */

/**
 * @param {ValidationPickRecord[]} subset
 * @param {string} id
 * @param {string} label
 * @param {PatternHorizonKey} horizonKey
 */
function aggregateBucketForHorizon(subset, id, label, horizonKey) {
  let successCount = 0
  let normalCount = 0
  let failureCount = 0
  let returnSum = 0
  let tracked = 0

  for (const p of subset) {
    const ret = p.horizons?.[horizonKey]
    if (ret == null || !Number.isFinite(ret)) continue
    tracked += 1
    returnSum += Number(ret)
    const outcome = classifyOutcome(Number(ret))
    if (outcome === "success") successCount += 1
    else if (outcome === "normal") normalCount += 1
    else if (outcome === "failure") failureCount += 1
  }

  const sufficient = tracked >= PATTERN_MIN_SAMPLE
  const successRate =
    sufficient && tracked > 0
      ? Math.round((successCount / tracked) * 1000) / 10
      : null
  const avgReturn =
    tracked > 0 ? Math.round((returnSum / tracked) * 10) / 10 : null

  return /** @type {PatternBucketStat} */ ({
    id,
    label,
    count: tracked,
    successCount,
    normalCount,
    failureCount,
    successRate,
    avgReturn,
    sufficient,
    pending: !sufficient,
  })
}

/** @param {string | null | undefined} raw */
export function normalizeMarketStateBucket(raw) {
  const s = String(raw ?? "").trim()
  if (!s || s === "—") return { id: "unknown", label: "미분류" }

  if (/상승\s*초기|early\s*rise/i.test(s)) return { id: "earlyRise", label: "상승초기" }
  if (/조정\s*회복|회복\s*진행|심리\s*회복|recovery/i.test(s)) return { id: "adjustmentRecovery", label: "조정회복" }
  if (/경계.*진입|경계\s*구간|^경계$/i.test(s)) return { id: "boundaryEntry", label: "경계진입" }
  if (/조정.*진입|조정\s*구간|조정\s*진행/i.test(s)) return { id: "adjustmentEntry", label: "조정진입" }
  if (/과열/i.test(s)) return { id: "overheat", label: "과열" }
  if (/패닉|위축|충격|공포/i.test(s)) return { id: "panic", label: "패닉·위축" }
  if (/관심|분할/i.test(s)) return { id: "interest", label: "관심·분할" }
  if (/방어/i.test(s)) return { id: "defensive", label: "방어" }
  if (/낙관/i.test(s)) return { id: "optimism", label: "낙관확대" }

  return { id: `raw:${s}`, label: s }
}

/** @param {number | null | undefined} intensity */
export function panicBucketForIntensity(intensity) {
  if (intensity == null || !Number.isFinite(intensity)) return null
  const v = Math.max(0, Math.min(100, Number(intensity)))
  for (let i = 0; i < PANIC_BUCKETS.length; i += 1) {
    const b = PANIC_BUCKETS[i]
    const isLast = i === PANIC_BUCKETS.length - 1
    if (v >= b.min && (v < b.max || (isLast && v <= b.max))) return b
  }
  return PANIC_BUCKETS[PANIC_BUCKETS.length - 1]
}

/**
 * @param {ValidationPickRecord[]} picks
 * @param {PatternHorizonKey} horizonKey
 * @param {(p: ValidationPickRecord) => string | null} keyFn
 * @param {(key: string, pick: ValidationPickRecord) => { id: string; label: string }}
 */
function groupAndAggregate(picks, horizonKey, keyFn, labelFn) {
  /** @type {Map<string, { id: string; label: string; picks: ValidationPickRecord[] }>} */
  const groups = new Map()

  for (const p of picks) {
    const key = keyFn(p)
    if (!key) continue
    const meta = labelFn(key, p)
    const gid = meta.id
    if (!groups.has(gid)) groups.set(gid, { id: gid, label: meta.label, picks: [] })
    groups.get(gid).picks.push(p)
  }

  return [...groups.values()]
    .map((g) => aggregateBucketForHorizon(g.picks, g.id, g.label, horizonKey))
    .sort((a, b) => {
      if (a.sufficient !== b.sufficient) return a.sufficient ? -1 : 1
      return (b.successRate ?? -1) - (a.successRate ?? -1)
    })
}

/**
 * @param {PatternBucketStat[]} rows
 * @param {number} limit
 */
function pickHighlights(rows, limit = 4) {
  const eligible = rows.filter((r) => r.sufficient && r.successRate != null)
  return [...eligible].sort((a, b) => (b.successRate ?? 0) - (a.successRate ?? 0)).slice(0, limit)
}

/**
 * @param {ValidationPickRecord[]} allPicks
 * @param {PatternHorizonKey} [horizonKey]
 * @returns {SuccessPatternReport}
 */
export function buildSuccessPatternReport(allPicks, horizonKey = "d30") {
  const picks = picksWithLockedHorizon(allPicks, horizonKey)
  const horizonLabel = PERF_HORIZONS.find((h) => h.key === horizonKey)?.label ?? horizonKey

  const quality = ["A", "B", "C"].map((g) =>
    aggregateBucketForHorizon(
      picks.filter((p) => String(getRecommendSnapshot(p)?.qualityGrade ?? p.qualityGrade ?? "") === g),
      `quality-${g}`,
      `품질 ${g}`,
      horizonKey,
    ),
  )

  const timing = ["A", "B", "C"].map((g) =>
    aggregateBucketForHorizon(
      picks.filter((p) => String(getRecommendSnapshot(p)?.timingGrade ?? p.timingGrade ?? "") === g),
      `timing-${g}`,
      `타이밍 ${g}`,
      horizonKey,
    ),
  )

  const marketFit = ["A", "B"].map((g) =>
    aggregateBucketForHorizon(
      picks.filter((p) => String(getRecommendSnapshot(p)?.marketFitGrade ?? p.marketFitGrade ?? "") === g),
      `marketFit-${g}`,
      `시장적합 ${g}`,
      horizonKey,
    ),
  )

  const marketStates = groupAndAggregate(
    picks,
    horizonKey,
    (p) => {
      const snap = getRecommendSnapshot(p)
      const label = snap?.marketStateLabel ?? p.strategyLabel ?? p.regimeLabel
      if (!label || label === "—") return null
      return normalizeMarketStateBucket(label).id
    },
    (_key, p) => {
      const snap = getRecommendSnapshot(p)
      const raw = snap?.marketStateLabel ?? p.strategyLabel ?? p.regimeLabel ?? "미분류"
      return normalizeMarketStateBucket(raw)
    },
  )

  const panicBands = PANIC_BUCKETS.map((b) =>
    aggregateBucketForHorizon(
      picks.filter((p) => {
        const snap = getRecommendSnapshot(p)
        return panicBucketForIntensity(snap?.panicIntensity)?.id === b.id
      }),
      b.id,
      `패닉 ${b.label}`,
      horizonKey,
    ),
  )

  const allGradeRows = [...quality, ...timing, ...marketFit]
  const highlights = [
    ...pickHighlights(allGradeRows, 2),
    ...pickHighlights(marketStates, 1),
    ...pickHighlights(panicBands, 1),
  ].slice(0, 4)

  return {
    horizonKey,
    horizonLabel,
    totalTracked: picks.length,
    criteria: { ...DEFAULT_OUTCOME_CRITERIA },
    highlights,
    grades: { quality, timing, marketFit },
    marketStates,
    panicBands,
  }
}

/** @param {number | null | undefined} rate @param {boolean} pending */
export function formatSuccessRate(rate, pending) {
  if (pending) return "분석 보류"
  if (rate == null || !Number.isFinite(rate)) return "—"
  return `${rate}%`
}

/** @param {PatternBucketStat} stat */
export function formatPatternStatLine(stat) {
  if (stat.pending) return `${stat.label} · 분석 보류 (n=${stat.count})`
  if (stat.successRate == null) return `${stat.label} · —`
  return `${stat.label} 성공률 ${stat.successRate}%`
}
