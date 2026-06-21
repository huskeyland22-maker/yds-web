/**
 * 패닉지수 구간별 추천 성과 심화 분석 — 7일 잠금
 */

import { picksWithLockedOutcome } from "./ydsPickOutcomeEngine.js"
import {
  PANIC_BUCKETS,
  panicBucketForIntensity,
} from "./ydsPickSuccessPatternEngine.js"
import { summarizeLockedReturns } from "./ydsPickReturnStats.js"
import { getRecommendSnapshot } from "./ydsValidationRecommendSnapshot.js"

/** @typedef {import("./ydsValidationStorage.js").ValidationPickRecord} ValidationPickRecord */

export const PANIC_DEEP_HORIZON = "d7"

/**
 * @typedef {{
 *   id: string
 *   label: string
 *   panicLabel: string
 *   count: number
 *   winRate: number | null
 *   avgReturn: number | null
 *   maxGain: number | null
 *   maxLoss: number | null
 * }} PanicZoneStat
 */

/**
 * @typedef {{
 *   horizonKey: 'd7'
 *   horizonLabel: string
 *   total: number
 *   zones: PanicZoneStat[]
 * }} PanicDeepAnalysisReport
 */

/**
 * @param {ValidationPickRecord[]} allPicks
 * @returns {PanicDeepAnalysisReport}
 */
export function buildPanicDeepAnalysisReport(allPicks) {
  const picks = picksWithLockedOutcome(allPicks ?? [], PANIC_DEEP_HORIZON)

  const zones = PANIC_BUCKETS.map((b) => {
    const subset = picks.filter((p) => {
      const snap = getRecommendSnapshot(p)
      const intensity = snap?.panicIntensity ?? p.recommendSnapshot?.panicIntensity
      return panicBucketForIntensity(intensity)?.id === b.id
    })

    const returns = subset
      .map((p) => p.horizons?.d7)
      .filter((r) => r != null && Number.isFinite(r))
      .map(Number)

    const stats = summarizeLockedReturns(returns)

    return {
      id: b.id,
      label: b.label,
      panicLabel: `패닉 ${b.label}`,
      ...stats,
    }
  })

  return {
    horizonKey: "d7",
    horizonLabel: "7일",
    total: picks.length,
    zones,
  }
}
