/**
 * YDS 행동점수 XAI — 기본·근거·보정 분해 (백테스트·최적화용 config)
 *
 * 행동점수 = 기본점수(+패닉) + 근거점수 + 보정점수 → 최종(타이밍 엔진 점수와 정합)
 */

/** @typedef {'short'|'mid'|'long'} ActionScoreHorizon */

/**
 * @typedef {{
 *   upTo: number
 *   label: string
 * }} PanicStatusBand
 */

/**
 * @typedef {{
 *   base: number
 *   panic: { neutral: number; scale: number; maxAbs: number; statusBands: PanicStatusBand[] }
 * }} HorizonXaiConfig
 */

/** 패닉 지수(0~100) → UI 정성 라벨 (가중치·기본점수 비노출) */
const DEFAULT_PANIC_STATUS_BANDS = Object.freeze([
  { upTo: 32, label: "안정 관망" },
  { upTo: 48, label: "중립 관망" },
  { upTo: 62, label: "경계 관망" },
  { upTo: 78, label: "스트레스 주의" },
  { upTo: 100, label: "공포 확대" },
])

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
    panic: { neutral: 50, scale: 0.04, maxAbs: 12, statusBands: DEFAULT_PANIC_STATUS_BANDS },
  },
  mid: {
    base: 68,
    panic: { neutral: 50, scale: 0.035, maxAbs: 10, statusBands: DEFAULT_PANIC_STATUS_BANDS },
  },
  long: {
    base: 65,
    panic: { neutral: 50, scale: 0.03, maxAbs: 10, statusBands: DEFAULT_PANIC_STATUS_BANDS },
  },
})

/** UI 맥락 라인 (보정·내부 가중과 분리 가능) */
export const ACTION_SCORE_XAI_CONTEXT = Object.freeze({
  bondAuxLabel: "채권·유동성 보조",
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

/**
 * @param {number | null | undefined} cycleScore
 * @param {PanicStatusBand[]} bands
 * @returns {string}
 */
export function panicStatusLabel(cycleScore, bands = DEFAULT_PANIC_STATUS_BANDS) {
  if (!Number.isFinite(Number(cycleScore))) return "데이터 부족"
  const s = Number(cycleScore)
  for (const band of bands) {
    if (s <= band.upTo) return band.label
  }
  return bands[bands.length - 1]?.label ?? "중립 관망"
}
