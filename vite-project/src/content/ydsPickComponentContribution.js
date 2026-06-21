/**
 * YDS 점수 구성요소(품질·타이밍·시장적합) 기여도 — 7일 잠금 수익률
 */

import { picksWithLockedOutcome } from "./ydsPickOutcomeEngine.js"
import {
  filterPicksByPatternGrade,
  MARKET_FIT_PATTERN_BUCKETS,
  patternGradeBucketLabel,
  QUALITY_PATTERN_BUCKETS,
  TIMING_PATTERN_BUCKETS,
} from "./ydsPickPatternGrades.js"
import { pearsonCorrelation } from "./ydsPickScoreCorrelation.js"
import { summarizeLockedReturns } from "./ydsPickReturnStats.js"
import { getRecommendSnapshot } from "./ydsValidationRecommendSnapshot.js"

/** @typedef {import("./ydsValidationStorage.js").ValidationPickRecord} ValidationPickRecord */
/** @typedef {'quality' | 'timing' | 'marketFit'} ComponentId */

export const COMPONENT_CONTRIBUTION_HORIZON = "d7"

/** @type {{ id: ComponentId; label: string; buckets: string[] }[]} */
export const SCORE_COMPONENTS = [
  { id: "quality", label: "기업품질", buckets: QUALITY_PATTERN_BUCKETS },
  { id: "timing", label: "타이밍", buckets: TIMING_PATTERN_BUCKETS },
  { id: "marketFit", label: "시장적합", buckets: MARKET_FIT_PATTERN_BUCKETS },
]

/**
 * @param {ValidationPickRecord} pick
 * @param {ComponentId} id
 */
export function getComponentLockedScore(pick, id) {
  const snap = getRecommendSnapshot(pick)
  const raw =
    id === "quality"
      ? snap?.qualityScore
      : id === "timing"
        ? snap?.timingScore
        : snap?.marketFitScore
  if (raw == null || !Number.isFinite(Number(raw))) return null
  return Number(raw)
}

/**
 * @typedef {{
 *   grade: string
 *   label: string
 *   count: number
 *   winRate: number | null
 *   avgReturn: number | null
 * }} ComponentGradeStat
 */

/**
 * @typedef {{
 *   id: ComponentId
 *   label: string
 *   correlation: number | null
 *   sampleCount: number
 *   grades: ComponentGradeStat[]
 * }} ComponentContributionView
 */

/**
 * @typedef {{
 *   rank: number
 *   id: ComponentId
 *   label: string
 *   correlation: number
 * }} ComponentRankEntry
 */

/**
 * @typedef {{
 *   horizonKey: 'd7'
 *   horizonLabel: string
 *   total: number
 *   components: ComponentContributionView[]
 *   ranking: ComponentRankEntry[]
 * }} ComponentContributionReport
 */

/**
 * @param {ValidationPickRecord[]} picks
 * @param {ComponentId} componentId
 * @param {string[]} gradeBuckets
 */
function buildComponentView(picks, componentId, gradeBuckets) {
  /** @type {number[]} */
  const scores = []
  /** @type {number[]} */
  const returns = []

  for (const pick of picks) {
    const score = getComponentLockedScore(pick, componentId)
    const ret = pick.horizons?.d7
    if (score == null || ret == null || !Number.isFinite(ret)) continue
    scores.push(score)
    returns.push(Number(ret))
  }

  const grades = gradeBuckets.map((grade) => {
    const subset = filterPicksByPatternGrade(picks, componentId, grade)
    const subsetReturns = subset
      .map((p) => p.horizons?.d7)
      .filter((r) => r != null && Number.isFinite(r))
      .map(Number)
    const stats = summarizeLockedReturns(subsetReturns)
    return {
      grade,
      label: patternGradeBucketLabel(componentId, grade),
      count: stats.count,
      winRate: stats.winRate,
      avgReturn: stats.avgReturn,
    }
  })

  return {
    id: componentId,
    label: SCORE_COMPONENTS.find((c) => c.id === componentId)?.label ?? componentId,
    correlation: pearsonCorrelation(scores, returns),
    sampleCount: scores.length,
    grades,
  }
}

/**
 * @param {ComponentContributionView[]} components
 */
function rankComponents(components) {
  const eligible = components
    .filter((c) => c.correlation != null && Number.isFinite(c.correlation))
    .sort((a, b) => Math.abs(b.correlation ?? 0) - Math.abs(a.correlation ?? 0))

  return eligible.map((c, i) => ({
    rank: i + 1,
    id: c.id,
    label: c.label,
    correlation: c.correlation ?? 0,
  }))
}

/**
 * @param {ValidationPickRecord[]} allPicks
 * @returns {ComponentContributionReport}
 */
export function buildComponentContributionReport(allPicks) {
  const picks = picksWithLockedOutcome(allPicks ?? [], COMPONENT_CONTRIBUTION_HORIZON)
  const components = SCORE_COMPONENTS.map((c) =>
    buildComponentView(picks, c.id, c.buckets),
  )

  return {
    horizonKey: "d7",
    horizonLabel: "7일",
    total: picks.length,
    components,
    ranking: rankComponents(components),
  }
}
