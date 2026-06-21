/**
 * 성과검증 성공패턴 — 등급 필드 읽기·버킷 정규화
 * snapshot(qualityGrade) · record · 한글 접두 혼용 대응
 */

import { getRecommendSnapshot } from "./ydsValidationRecommendSnapshot.js"

/** @typedef {import("./ydsValidationStorage.js").ValidationPickRecord} ValidationPickRecord */
/** @typedef {'quality' | 'timing' | 'marketFit'} PatternGradeField */

export const QUALITY_PATTERN_BUCKETS = ["A", "B", "C", "D"]
export const TIMING_PATTERN_BUCKETS = ["A", "B", "C", "D"]
export const MARKET_FIT_PATTERN_BUCKETS = ["A", "B", "C"]

/** @param {string | null | undefined} raw */
export function parseRawGrade(raw) {
  const s = String(raw ?? "").trim()
  if (!s || s === "—" || s === "undefined" || s === "null") return null

  const prefixed = s.match(/(?:기업\s*)?품질|타이밍|시장\s*적합/i)
  if (prefixed) {
    const letter = s.match(/([A-F][+]?)\s*$/i)
    if (letter) return letter[1].toUpperCase()
  }

  const direct = s.match(/^([A-F][+]?)$/i)
  if (direct) return direct[1].toUpperCase()

  const embedded = s.match(/\b([A-F][+]?)\b/i)
  return embedded ? embedded[1].toUpperCase() : null
}

/**
 * @param {PatternGradeField} field
 * @param {string | null | undefined} raw
 */
export function bucketPatternGrade(field, raw) {
  const g = parseRawGrade(raw)
  if (!g) return null

  if (field === "quality") {
    if (g === "A+" || g === "A") return "A"
    if (g === "B") return "B"
    if (g === "C") return "C"
    if (g === "D" || g === "F") return "D"
    return null
  }

  if (field === "timing") {
    if (g === "A" || g === "B" || g === "C") return g
    if (g === "D" || g === "F") return "D"
    return null
  }

  if (g === "A" || g === "B") return g
  if (g === "C" || g === "D" || g === "F") return "C"
  return null
}

/**
 * @param {ValidationPickRecord} pick
 * @param {PatternGradeField} field
 */
export function getPickPatternGrade(pick, field) {
  const snap = getRecommendSnapshot(pick)
  const fromSnap =
    field === "quality"
      ? snap?.qualityGrade
      : field === "timing"
        ? snap?.timingGrade
        : snap?.marketFitGrade

  const fromRecord =
    field === "quality"
      ? pick.qualityGrade
      : field === "timing"
        ? pick.timingGrade
        : pick.marketFitGrade

  return bucketPatternGrade(field, fromSnap ?? fromRecord)
}

/** @param {PatternGradeField} field @param {string} bucket */
export function patternGradeBucketLabel(field, bucket) {
  if (field === "quality") return `품질 ${bucket}`
  if (field === "timing") return `타이밍 ${bucket}`
  return `시장적합 ${bucket}`
}

/**
 * @param {ValidationPickRecord[]} picks
 * @param {PatternGradeField} field
 * @param {string} bucket
 */
export function filterPicksByPatternGrade(picks, field, bucket) {
  return (picks ?? []).filter((p) => getPickPatternGrade(p, field) === bucket)
}
