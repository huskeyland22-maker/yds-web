/**
 * 패닉 강도 — 5단계 매수 관점 투자 해석 (카드 · 그래프 · 툴팁 단일 기준)
 *
 * 0~20   극단적 공포
 * 20~40  공포
 * 40~60  중립
 * 60~80  관심
 * 80~100 과열
 */

/** @typedef {'extremeFear' | 'fear' | 'neutral' | 'interest' | 'overheat'} PanicInvestmentStageId */

/**
 * @typedef {{
 *   id: PanicInvestmentStageId
 *   index: number
 *   label: string
 *   min: number
 *   max: number
 *   color: string
 *   buyStrength: string
 *   actionLine: string
 *   descriptionLines: string[]
 *   stageBar: string
 *   currentLine: string
 *   score: number
 * }} PanicIntensityInterpretation
 */

/** @type {Array<{
 *   id: PanicInvestmentStageId
 *   label: string
 *   min: number
 *   max: number
 *   color: string
 *   buyStrength: string
 *   actionLine: string
 * }>} */
export const PANIC_INVESTMENT_STAGES = [
  {
    id: "extremeFear",
    label: "극단적 공포",
    min: 0,
    max: 20,
    color: "#3b82f6",
    buyStrength: "★★★★★",
    actionLine: "역사적으로 가장 공격적인 분할매수 구간",
  },
  {
    id: "fear",
    label: "공포",
    min: 21,
    max: 40,
    color: "#22c55e",
    buyStrength: "★★★★☆",
    actionLine: "적극적인 분할매수 가능",
  },
  {
    id: "neutral",
    label: "중립",
    min: 41,
    max: 60,
    color: "#eab308",
    buyStrength: "★★★☆☆",
    actionLine: "관심종목 관찰 및 분할 접근",
  },
  {
    id: "interest",
    label: "관심",
    min: 61,
    max: 80,
    color: "#f97316",
    buyStrength: "★★☆☆☆",
    actionLine: "신규 매수는 신중, 보유 비중 관리",
  },
  {
    id: "overheat",
    label: "과열",
    min: 81,
    max: 100,
    color: "#ef4444",
    buyStrength: "★☆☆☆☆",
    actionLine: "추격매수 금지, 차익실현 고려",
  },
]

/** @deprecated use PANIC_INVESTMENT_STAGES labels */
export const PANIC_SENTIMENT_STAGE_LABELS = PANIC_INVESTMENT_STAGES.map((s) => s.label)

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
  return PANIC_INVESTMENT_STAGES.map((_, index) => (index === activeIndex ? "■" : "□")).join(
    " ",
  )
}

/** @param {number} score @param {string} label */
export function formatPanicCurrentStageLine(score, label) {
  return `현재 : ${label} (${Math.round(score)})`
}

const PANIC_ZONE_BOUNDARIES = [0, 20, 40, 60, 80, 100]

/** @returns {Array<{ min: number; max: number; color: string; label: string }>} */
export function panicInvestmentZoneSteps() {
  return PANIC_INVESTMENT_STAGES.map((stage, index) => ({
    min: PANIC_ZONE_BOUNDARIES[index],
    max: PANIC_ZONE_BOUNDARIES[index + 1],
    color: stage.color,
    label: stage.label,
  }))
}

/**
 * @param {number | null | undefined} score
 * @returns {PanicIntensityInterpretation | null}
 */
export function buildPanicIntensityInterpretation(score) {
  if (score == null || !Number.isFinite(score)) return null
  const rounded = Math.max(0, Math.min(100, Math.round(Number(score))))
  const index = resolvePanicSentimentStageIndex(rounded)
  const stage = PANIC_INVESTMENT_STAGES[index]
  return {
    id: stage.id,
    index,
    label: stage.label,
    min: stage.min,
    max: stage.max,
    color: stage.color,
    buyStrength: stage.buyStrength,
    actionLine: stage.actionLine,
    descriptionLines: [stage.actionLine],
    stageBar: buildPanicStageBar(index),
    currentLine: formatPanicCurrentStageLine(rounded, stage.label),
    score: rounded,
  }
}

/** @deprecated use resolvePanicSentimentStageIndex */
export function resolvePanicInterpretBandId(score) {
  const interp = buildPanicIntensityInterpretation(score)
  return interp?.id ?? "neutral"
}
