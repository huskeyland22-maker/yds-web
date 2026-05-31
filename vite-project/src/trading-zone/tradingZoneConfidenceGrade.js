/**
 * 신뢰도 점수 → 등급 (별 + 문자)
 */

/**
 * @typedef {{
 *   score: number
 *   letter: string
 *   stars: string
 *   filled: number
 *   threshold: number
 * }} ConfidenceGrade
 */

/** @param {number | null | undefined} raw */
export function resolveConfidenceGrade(raw) {
  const score = Math.round(Number(raw))
  if (!Number.isFinite(score)) {
    return { score: NaN, letter: "—", stars: "—", filled: 0, threshold: 0 }
  }
  if (score >= 95) return { score, letter: "A+", stars: "★★★★★", filled: 5, threshold: 95 }
  if (score >= 85) return { score, letter: "A", stars: "★★★★☆", filled: 4, threshold: 85 }
  if (score >= 75) return { score, letter: "B+", stars: "★★★☆☆", filled: 3, threshold: 75 }
  if (score >= 65) return { score, letter: "B", stars: "★★☆☆☆", filled: 2, threshold: 65 }
  return { score, letter: "C", stars: "★☆☆☆☆", filled: 1, threshold: 0 }
}
