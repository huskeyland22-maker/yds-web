/**
 * 패닉 강도 — 5단계 투자심리 · 상태 설명 · 행동 가이드
 */

/** @typedef {'extremeFear' | 'fear' | 'neutral' | 'greed' | 'extremeGreed'} PanicSentimentStageId */

/**
 * @typedef {{
 *   id: PanicSentimentStageId
 *   index: number
 *   label: string
 *   min: number
 *   max: number
 *   descriptionLines: string[]
 * }} PanicIntensityInterpretation
 */

export const PANIC_SENTIMENT_STAGE_LABELS = [
  "극도 공포",
  "공포",
  "중립",
  "탐욕",
  "극도 탐욕",
]

/** @type {Array<{ id: PanicSentimentStageId; label: string; min: number; max: number; descriptionLines: string[] }>} */
const PANIC_SENTIMENT_STAGES = [
  {
    id: "extremeFear",
    label: "극도 공포",
    min: 0,
    max: 20,
    descriptionLines: [
      "투자심리가 극단적으로 위축",
      "우량주 분할매수 기회",
      "역사적 고수익 구간 가능",
      "현금 투입 검토",
    ],
  },
  {
    id: "fear",
    label: "공포",
    min: 21,
    max: 40,
    descriptionLines: [
      "시장 심리가 위축된 상태",
      "관심종목 분할매수 구간",
      "변동성 대비 접근",
      "추격보다 분할 우선",
    ],
  },
  {
    id: "neutral",
    label: "중립",
    min: 41,
    max: 60,
    descriptionLines: [
      "시장 심리가 균형 상태",
      "실적주 중심 접근",
      "관심종목 관찰",
      "추격매수 자제",
    ],
  },
  {
    id: "greed",
    label: "탐욕",
    min: 61,
    max: 80,
    descriptionLines: [
      "시장 심리가 낙관적",
      "단기 과열 가능성 존재",
      "신규 진입은 선별적으로",
      "분할 접근 권장",
    ],
  },
  {
    id: "extremeGreed",
    label: "극도 탐욕",
    min: 81,
    max: 100,
    descriptionLines: [
      "시장 낙관이 과도한 상태",
      "신규 진입보다 수익 보호",
      "추격매수 주의",
      "현금 비중 점검",
    ],
  },
]

/** @param {number} score */
export function resolvePanicSentimentStageIndex(score) {
  const s = Math.max(0, Math.min(100, Math.round(Number(score))))
  if (s <= 20) return 0
  if (s <= 40) return 1
  if (s <= 60) return 2
  if (s <= 80) return 3
  return 4
}

/** @param {number} activeIndex */
export function buildPanicStageBar(activeIndex) {
  return PANIC_SENTIMENT_STAGE_LABELS.map((_, index) => (index === activeIndex ? "■" : "□")).join(
    " ",
  )
}

/** @param {number} score @param {string} label */
export function formatPanicCurrentStageLine(score, label) {
  return `현재 : ${label} (${Math.round(score)})`
}

/** @param {number | null | undefined} score */
export function buildPanicIntensityInterpretation(score) {
  if (score == null || !Number.isFinite(score)) return null
  const rounded = Math.max(0, Math.min(100, Math.round(Number(score))))
  const index = resolvePanicSentimentStageIndex(rounded)
  const stage = PANIC_SENTIMENT_STAGES[index]
  return {
    id: stage.id,
    index,
    label: stage.label,
    min: stage.min,
    max: stage.max,
    descriptionLines: stage.descriptionLines,
    stageBar: buildPanicStageBar(index),
    currentLine: formatPanicCurrentStageLine(rounded, stage.label),
  }
}

/** @deprecated use resolvePanicSentimentStageIndex */
export function resolvePanicInterpretBandId(score) {
  const interp = buildPanicIntensityInterpretation(score)
  return interp?.id ?? "neutral"
}
