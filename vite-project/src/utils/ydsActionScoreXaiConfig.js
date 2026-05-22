/**
 * YDS 행동점수 XAI — 기본·근거·보정 분해 (백테스트·최적화용 config)
 *
 * 행동점수 = 기본점수(+패닉) + 근거점수 + 보정점수 → 최종(타이밍 엔진 점수와 정합)
 */

/** @typedef {'short'|'mid'|'long'} ActionScoreHorizon */

/**
 * @typedef {{
 *   base: number
 *   panic: { neutral: number; scale: number; maxAbs: number }
 * }} HorizonXaiConfig
 */

/** @typedef {{
 *   key: string
 *   label: string
 *   enabled: boolean
 * }} AdjustmentDef
 */

/** @type {Record<ActionScoreHorizon, HorizonXaiConfig>} */
export const ACTION_SCORE_XAI_HORIZON = Object.freeze({
  short: {
    base: 70,
    panic: { neutral: 50, scale: 0.04, maxAbs: 12 },
  },
  mid: {
    base: 68,
    panic: { neutral: 50, scale: 0.035, maxAbs: 10 },
  },
  long: {
    base: 65,
    panic: { neutral: 50, scale: 0.03, maxAbs: 10 },
  },
})

/** 보정 축 — enabled·weight는 백테스트에서 조정 */
export const ACTION_SCORE_XAI_ADJUSTMENTS = Object.freeze([
  { key: "bondLiquidity", label: "채권유동성", enabled: true, weight: 1 },
  { key: "metaRisk", label: "MetaRisk", enabled: true, weight: 1 },
  { key: "encycle", label: "엔케리", enabled: true, weight: 1 },
])

/** @param {ActionScoreHorizon} horizon @returns {HorizonXaiConfig} */
export function horizonXaiConfig(horizon) {
  return ACTION_SCORE_XAI_HORIZON[horizon] ?? ACTION_SCORE_XAI_HORIZON.short
}
