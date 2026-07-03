/**
 * 패닉 강도 — 5단계 공포 강도 체계 (GO #84 · 카드 · 그래프 · 툴팁 단일 기준)
 *
 * 0~20   공포 부족
 * 21~40  약한 공포
 * 41~60  중립
 * 61~80  높은 공포
 * 81~100 극심한 공포
 */

/** @typedef {'lackOfFear' | 'mildFear' | 'neutral' | 'highFear' | 'extremeFear'} PanicIntensityStageId */

/**
 * @typedef {{
 *   id: PanicIntensityStageId
 *   index: number
 *   label: string
 *   emoji: string
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
 *   id: PanicIntensityStageId
 *   label: string
 *   emoji: string
 *   min: number
 *   max: number
 *   color: string
 *   buyStrength: string
 *   descriptionLines: string[]
 * }>} */
export const PANIC_INVESTMENT_STAGES = [
  {
    id: "lackOfFear",
    label: "공포 부족",
    emoji: "🔵",
    min: 0,
    max: 20,
    color: "#3b82f6",
    buyStrength: "★☆☆☆☆",
    descriptionLines: [
      "시장 참여자들의 낙관 심리가 강합니다.",
      "과도한 낙관은 향후 변동성을 키울 수 있습니다.",
    ],
  },
  {
    id: "mildFear",
    label: "약한 공포",
    emoji: "🟢",
    min: 21,
    max: 40,
    color: "#22c55e",
    buyStrength: "★★☆☆☆",
    descriptionLines: [
      "공포 심리가 일부 존재하지만 아직 낮은 수준입니다.",
      "시장 심리는 비교적 안정적입니다.",
    ],
  },
  {
    id: "neutral",
    label: "중립",
    emoji: "🟡",
    min: 41,
    max: 60,
    color: "#eab308",
    buyStrength: "★★★☆☆",
    descriptionLines: ["공포와 낙관이 균형을 이루는 상태입니다."],
  },
  {
    id: "highFear",
    label: "높은 공포",
    emoji: "🟠",
    min: 61,
    max: 80,
    color: "#f97316",
    buyStrength: "★★★★☆",
    descriptionLines: [
      "시장 심리가 위축되고 있습니다.",
      "변동성 확대에 유의해야 합니다.",
    ],
  },
  {
    id: "extremeFear",
    label: "극심한 공포",
    emoji: "🔴",
    min: 81,
    max: 100,
    color: "#ef4444",
    buyStrength: "★★★★★",
    descriptionLines: [
      "투매 심리가 극대화된 구간입니다.",
      "역발상 관점에서는 장기 매수 기회를 검토할 수 있습니다.",
    ],
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

/**
 * @param {number | null | undefined} score
 * @returns {string | null}
 */
export function formatPanicIntensityStageDisplay(score) {
  const interp = buildPanicIntensityInterpretation(score)
  if (!interp) return null
  return `${interp.emoji} ${interp.label}`
}

const PANIC_ZONE_BOUNDARIES = [0, 20, 40, 60, 80, 100]

/** @returns {Array<{ min: number; max: number; color: string; label: string; emoji: string }>} */
export function panicInvestmentZoneSteps() {
  return PANIC_INVESTMENT_STAGES.map((stage, index) => ({
    min: PANIC_ZONE_BOUNDARIES[index],
    max: PANIC_ZONE_BOUNDARIES[index + 1],
    color: stage.color,
    label: stage.label,
    emoji: stage.emoji,
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
    emoji: stage.emoji,
    min: stage.min,
    max: stage.max,
    color: stage.color,
    buyStrength: stage.buyStrength,
    actionLine: stage.descriptionLines[0] ?? "",
    descriptionLines: stage.descriptionLines,
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
