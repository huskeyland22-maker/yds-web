/**
 * YDS V1.9 Panic Distance Layer — 표시 전용 (점수·구간·가중치 무관)
 * 현재 패닉 강도에서 다음 기회 구간까지 남은 거리
 */

import { PANIC_STATUS_BANDS } from "./ydsStatusLabels.js"

/** @typedef {{
 *   id: string
 *   threshold: number
 *   emoji: string
 *   label: string
 *   distanceKey: "distanceToInterest" | "distanceToAccumulation" | "distanceToLifeOpportunity"
 * }} PanicDistanceTier
 */

/** @param {string} bandId */
function bandMin(bandId) {
  const band = PANIC_STATUS_BANDS.find((b) => b.id === bandId)
  return band?.min ?? 0
}

/** @type {PanicDistanceTier[]} */
export const PANIC_DISTANCE_TIERS = [
  {
    id: "interest",
    threshold: bandMin("interest"),
    emoji: "🟡",
    label: "관심",
    distanceKey: "distanceToInterest",
  },
  {
    id: "dca",
    threshold: bandMin("dca"),
    emoji: "🟠",
    label: "분할매수",
    distanceKey: "distanceToAccumulation",
  },
  {
    id: "lifePoint",
    threshold: bandMin("lifePoint"),
    emoji: "🔴",
    label: "인생타점",
    distanceKey: "distanceToLifeOpportunity",
  },
]

/**
 * @param {number | null | undefined} scoreRaw
 */
function clampScore(scoreRaw) {
  if (scoreRaw == null || !Number.isFinite(Number(scoreRaw))) return null
  return Math.max(0, Math.min(100, Math.round(Number(scoreRaw))))
}

/**
 * @param {number} score
 * @param {PanicDistanceTier} tier
 */
function resolveDistanceLine(score, tier) {
  const entered = score >= tier.threshold
  const distance = entered ? 0 : tier.threshold - score
  return {
    id: tier.id,
    emoji: tier.emoji,
    label: tier.label,
    threshold: tier.threshold,
    entered,
    distance,
    text: entered ? `${tier.label} 진입` : `${tier.label}까지 +${distance}`,
  }
}

/**
 * @typedef {{
 *   score: number
 *   distanceToInterest: number
 *   distanceToAccumulation: number
 *   distanceToLifeOpportunity: number
 *   lines: ReturnType<typeof resolveDistanceLine>[]
 * }} PanicDistanceView
 */

/**
 * @param {number | null | undefined} scoreRaw
 * @returns {PanicDistanceView | null}
 */
export function resolvePanicDistance(scoreRaw) {
  const score = clampScore(scoreRaw)
  if (score == null) return null

  const lines = PANIC_DISTANCE_TIERS.map((tier) => resolveDistanceLine(score, tier))

  /** @type {Record<string, number>} */
  const distances = {}
  for (const tier of PANIC_DISTANCE_TIERS) {
    const line = lines.find((l) => l.id === tier.id)
    distances[tier.distanceKey] = line?.distance ?? 0
  }

  return {
    score,
    distanceToInterest: distances.distanceToInterest,
    distanceToAccumulation: distances.distanceToAccumulation,
    distanceToLifeOpportunity: distances.distanceToLifeOpportunity,
    lines,
  }
}
