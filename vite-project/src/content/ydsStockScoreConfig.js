/**
 * YDS Phase 2-2 — 종목 점수 구조 (설계 전용 · 계산 엔진 없음)
 * Phase 2-3에서 실데이터 연결 예정
 */

export const YDS_SCORE_WEIGHTS = {
  trend: 40,
  volume: 20,
  position: 20,
  marketFit: 20,
  total: 100,
}

/** @typedef {'trend' | 'volume' | 'position' | 'marketFit'} YdsScoreComponentId */

export const YDS_SCORE_COMPONENTS = [
  { id: "trend", label: "추세", max: YDS_SCORE_WEIGHTS.trend },
  { id: "volume", label: "거래량", max: YDS_SCORE_WEIGHTS.volume },
  { id: "position", label: "위치", max: YDS_SCORE_WEIGHTS.position },
  { id: "marketFit", label: "시장 적합도", max: YDS_SCORE_WEIGHTS.marketFit },
]

/**
 * @typedef {{
 *   trendScore: number
 *   volumeScore: number
 *   positionScore: number
 *   marketFitScore: number
 *   totalScore: number
 * }} YdsScoreBreakdown
 */

/**
 * @param {Partial<YdsScoreBreakdown>} raw
 * @returns {YdsScoreBreakdown | null}
 */
export function normalizeScoreBreakdown(raw) {
  const trendScore = Number(raw.trendScore)
  const volumeScore = Number(raw.volumeScore)
  const positionScore = Number(raw.positionScore)
  const marketFitScore = Number(raw.marketFitScore)
  if (
    ![trendScore, volumeScore, positionScore, marketFitScore].every(Number.isFinite)
  ) {
    return null
  }
  const sum = trendScore + volumeScore + positionScore + marketFitScore
  const totalScore = Number.isFinite(raw.totalScore) ? Number(raw.totalScore) : sum
  return { trendScore, volumeScore, positionScore, marketFitScore, totalScore }
}

/**
 * @param {YdsScoreBreakdown} scores
 * @returns {{ id: YdsScoreComponentId; label: string; value: number; max: number; display: string }[]}
 */
export function formatScoreBreakdownRows(scores) {
  return YDS_SCORE_COMPONENTS.map((c) => ({
    id: c.id,
    label: c.label,
    value: scores[`${c.id}Score`],
    max: c.max,
    display: `${scores[`${c.id}Score`]}/${c.max}`,
  }))
}
