/**
 * V4 — 기업품질/타이밍 등급 · TOP5 최종점수 · 5단계 추천 상태
 */

import { PHASE3_QUALITY_MAX } from "./ydsStockPickPhase3Breakdown.js"
import { TIMING_SCORE_MAX } from "./ydsStockPickTimingScore.js"

/** @typedef {'A' | 'B' | 'C' | 'D' | 'F'} ScoreLetterGrade */
/** @typedef {'aggressiveBuy' | 'buy' | 'scaleIn' | 'watch' | 'noChase'} V4RecommendStatusId */

export const V4_QUALITY_WEIGHT = 0.7
export const V4_TIMING_WEIGHT = 0.3
export const V4_TIMING_PENALTY_THRESHOLD = 10
export const V4_TIMING_PENALTY_POINTS = 10
export const V4_TOP5_MIN_TIMING = 5

/** @typedef {'A+' | 'A' | 'B' | 'C' | 'D' | 'F'} QualityDisplayGrade */

/** @param {number} quality @returns {QualityDisplayGrade} */
export function qualityToDisplayGrade(quality) {
  if (quality >= 70) return "A+"
  if (quality >= 60) return "A"
  if (quality >= 50) return "B"
  if (quality >= 40) return "C"
  if (quality >= 30) return "D"
  return "F"
}

/** @param {number} quality @returns {ScoreLetterGrade} */
export function qualityToGrade(quality) {
  if (quality >= 60) return "A"
  if (quality >= 50) return "B"
  if (quality >= 40) return "C"
  if (quality >= 30) return "D"
  return "F"
}

/** @param {number} timing @returns {ScoreLetterGrade} */
export function timingToGrade(timing) {
  if (timing >= 21) return "A"
  if (timing >= 18) return "B"
  if (timing >= 14) return "C"
  if (timing >= 8) return "D"
  return "F"
}

/** @type {Record<ScoreLetterGrade, Record<ScoreLetterGrade, V4RecommendStatusId>>} */
export const V4_RECOMMEND_MATRIX = {
  A: { A: "aggressiveBuy", B: "buy", C: "scaleIn", D: "watch", F: "noChase" },
  B: { A: "buy", B: "buy", C: "scaleIn", D: "watch", F: "noChase" },
  C: { A: "scaleIn", B: "scaleIn", C: "watch", D: "watch", F: "noChase" },
  D: { A: "watch", B: "watch", C: "watch", D: "noChase", F: "noChase" },
  F: { A: "watch", B: "noChase", C: "noChase", D: "noChase", F: "noChase" },
}

/**
 * @param {number} quality
 * @param {number} timing
 */
export function computeFinalRankScore(quality, timing) {
  let score = quality * V4_QUALITY_WEIGHT + timing * V4_TIMING_WEIGHT
  if (timing <= V4_TIMING_PENALTY_THRESHOLD) {
    score -= V4_TIMING_PENALTY_POINTS
  }
  return Math.round(Math.max(0, score) * 10) / 10
}

/** @param {number} timing */
export function isTop5Eligible(timing) {
  return timing > V4_TOP5_MIN_TIMING
}

/**
 * @typedef {{
 *   quality: number
 *   timing: number
 *   total: number
 *   qualityGrade: ScoreLetterGrade
 *   qualityDisplayGrade: QualityDisplayGrade
 *   timingGrade: ScoreLetterGrade
 *   qualityDisplay: string
 *   timingDisplay: string
 *   finalRankScore: number
 *   top5Eligible: boolean
 *   recommendStatusId: V4RecommendStatusId
 *   debug: Record<string, unknown>
 * }} V4StockScore
 */

/**
 * @param {number} quality
 * @param {number} timing
 * @returns {V4StockScore}
 */
export function computeV4Score(quality, timing) {
  const qualityGrade = qualityToGrade(quality)
  const qualityDisplayGrade = qualityToDisplayGrade(quality)
  const timingGrade = timingToGrade(timing)
  const recommendStatusId = V4_RECOMMEND_MATRIX[qualityGrade][timingGrade]
  const finalRankScore = computeFinalRankScore(quality, timing)
  const top5Eligible = isTop5Eligible(timing)
  const total = quality + timing

  return {
    quality,
    timing,
    total,
    qualityGrade,
    qualityDisplayGrade,
    timingGrade,
    qualityDisplay: `${qualityDisplayGrade} (${quality}/${PHASE3_QUALITY_MAX})`,
    timingDisplay: `${timingGrade} (${timing}/${TIMING_SCORE_MAX})`,
    finalRankScore,
    top5Eligible,
    recommendStatusId,
    debug: {
      formula: "finalRank = quality×70% + timing×30% (−10 if timing≤10)",
      qualityWeight: V4_QUALITY_WEIGHT,
      timingWeight: V4_TIMING_WEIGHT,
      penaltyApplied: timing <= V4_TIMING_PENALTY_THRESHOLD,
      top5Eligible,
      matrix: `${qualityGrade}+${timingGrade} → ${recommendStatusId}`,
    },
  }
}
