/**
 * 추천 총점 vs 7일 실제 성과 상관관계 (저장 데이터만)
 */

import { calcRecommendReturnPct } from "../trading-zone/tradingZoneRecommendationTrack.js"
import { picksWithLockedOutcome } from "./ydsPickOutcomeEngine.js"
import { roundReturnPct } from "./ydsPickReliabilityAudit.js"
import { getRecommendSnapshot } from "./ydsValidationRecommendSnapshot.js"

/** @typedef {import("./ydsValidationStorage.js").ValidationPickRecord} ValidationPickRecord */

export const SCORE_CORRELATION_HORIZON = "d7"

/** @type {{ id: string; label: string; min: number; max: number | null }[]} */
export const SCORE_BUCKETS = [
  { id: "g90", label: "90+", min: 90, max: null },
  { id: "g80", label: "80~89", min: 80, max: 89.999 },
  { id: "g70", label: "70~79", min: 70, max: 79.999 },
  { id: "g60", label: "60~69", min: 60, max: 69.999 },
  { id: "gLow", label: "60 미만", min: -Infinity, max: 59.999 },
]

/**
 * @param {ValidationPickRecord} pick
 * @returns {number | null}
 */
export function getPickLockedScore(pick) {
  const snap = getRecommendSnapshot(pick)
  const score = snap?.totalScore ?? pick.recommendedScore
  if (score == null || !Number.isFinite(Number(score))) return null
  return Math.round(Number(score) * 10) / 10
}

/**
 * @param {number} score
 */
export function scoreToBucketId(score) {
  for (const b of SCORE_BUCKETS) {
    if (score >= b.min && (b.max == null || score <= b.max)) return b.id
  }
  return "gLow"
}

/**
 * @param {number[]} xs
 * @param {number[]} ys
 */
export function pearsonCorrelation(xs, ys) {
  if (xs.length !== ys.length || xs.length < 2) return null
  const n = xs.length
  const meanX = xs.reduce((s, v) => s + v, 0) / n
  const meanY = ys.reduce((s, v) => s + v, 0) / n
  let num = 0
  let denX = 0
  let denY = 0
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - meanX
    const dy = ys[i] - meanY
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  const den = Math.sqrt(denX * denY)
  if (!den) return null
  return Math.round((num / den) * 1000) / 1000
}

/**
 * @typedef {{
 *   id: string
 *   label: string
 *   count: number
 *   winRate: number | null
 *   avgReturn: number | null
 * }} ScoreBucketStat
 */

/**
 * @typedef {{
 *   horizonKey: 'd7'
 *   horizonLabel: string
 *   total: number
 *   correlation: number | null
 *   correlationLabel: string
 *   buckets: ScoreBucketStat[]
 * }} ScoreCorrelationReport
 */

/**
 * @param {string | null} r
 */
function correlationLabel(r) {
  if (r == null) return "표본 부족"
  const abs = Math.abs(r)
  if (abs >= 0.5) return r > 0 ? "양의 상관 (강)" : "음의 상관 (강)"
  if (abs >= 0.25) return r > 0 ? "양의 상관 (약)" : "음의 상관 (약)"
  return "상관 미약"
}

/**
 * @param {ValidationPickRecord[]} allPicks
 * @returns {ScoreCorrelationReport}
 */
export function buildScoreCorrelationReport(allPicks) {
  const withD7 = picksWithLockedOutcome(allPicks ?? [], SCORE_CORRELATION_HORIZON)

  /** @type {Map<string, { scores: number[]; returns: number[] }>} */
  const groups = new Map()
  for (const b of SCORE_BUCKETS) {
    groups.set(b.id, { scores: [], returns: [] })
  }

  /** @type {number[]} */
  const allScores = []
  /** @type {number[]} */
  const allReturns = []

  for (const pick of withD7) {
    const score = getPickLockedScore(pick)
    const ret = pick.horizons?.d7
    if (score == null || ret == null || !Number.isFinite(ret)) continue

    const returnPct = Number(ret)
    const bucketId = scoreToBucketId(score)
    const g = groups.get(bucketId)
    if (g) {
      g.scores.push(score)
      g.returns.push(returnPct)
    }
    allScores.push(score)
    allReturns.push(returnPct)
  }

  const buckets = SCORE_BUCKETS.map((b) => {
    const g = groups.get(b.id)
    const returns = g?.returns ?? []
    const count = returns.length
    if (!count) {
      return { id: b.id, label: b.label, count: 0, winRate: null, avgReturn: null }
    }
    const wins = returns.filter((v) => v > 0).length
    const avg = returns.reduce((s, v) => s + v, 0) / count
    return {
      id: b.id,
      label: b.label,
      count,
      winRate: Math.round((wins / count) * 1000) / 10,
      avgReturn: Math.round(avg * 10) / 10,
    }
  })

  const correlation = pearsonCorrelation(allScores, allReturns)

  return {
    horizonKey: "d7",
    horizonLabel: "7일",
    total: allScores.length,
    correlation,
    correlationLabel: correlationLabel(correlation),
    buckets,
  }
}

/** @param {ValidationPickRecord} pick @returns {number | null} */
export function getPickD7Return(pick) {
  const ret = pick.horizons?.d7
  if (ret == null || !Number.isFinite(ret)) return null
  return Number(ret)
}

/** Re-export for tests — calc from stored prices */
export function calcD7ReturnFromStored(pick) {
  const price = pick.recommendedPrice
  const d7 = pick.horizonPrices?.d7
  if (price == null || d7 == null) return null
  return roundReturnPct(calcRecommendReturnPct(price, d7))
}
