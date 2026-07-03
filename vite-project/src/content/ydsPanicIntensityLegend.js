/**
 * 패닉 강도 — 6단계 범례 (카드 · 추이 그래프 UI 전용 · 점수 산출 무관)
 *
 * 0~15   극단적 탐욕
 * 16~30  탐욕
 * 31~45  공포 부족
 * 46~60  중립
 * 61~75  공포
 * 76~100 극단적 공포
 */

/** @typedef {'extremeGreed' | 'greed' | 'lackOfFear' | 'neutral' | 'fear' | 'extremeFear'} PanicIntensityLegendId */

/**
 * @typedef {{
 *   id: PanicIntensityLegendId
 *   index: number
 *   label: string
 *   shortLabel: string
 *   emoji: string
 *   min: number
 *   max: number
 *   color: string
 *   rangeLabel: string
 *   tooltipTitle: string
 *   tooltipText: string
 *   score: number
 * }} PanicIntensityLegendView
 */

/** @type {Array<{
 *   id: PanicIntensityLegendId
 *   label: string
 *   shortLabel: string
 *   emoji: string
 *   min: number
 *   max: number
 *   color: string
 *   tooltipText: string
 * }>} */
export const PANIC_INTENSITY_LEGEND_STAGES = [
  {
    id: "extremeGreed",
    label: "극단적 탐욕",
    shortLabel: "극단적 탐욕",
    emoji: "🔥",
    min: 0,
    max: 15,
    color: "#f43f5e",
    tooltipText: "시장 과열 구간으로 신규 매수는 신중하게 접근합니다.",
  },
  {
    id: "greed",
    label: "탐욕",
    shortLabel: "탐욕",
    emoji: "🟠",
    min: 16,
    max: 30,
    color: "#f97316",
    tooltipText: "낙관 심리가 우세한 구간입니다.",
  },
  {
    id: "lackOfFear",
    label: "공포 부족",
    shortLabel: "공포 부족",
    emoji: "🟡",
    min: 31,
    max: 45,
    color: "#eab308",
    tooltipText: "건전한 강세장이 이어질 가능성이 높은 구간입니다.",
  },
  {
    id: "neutral",
    label: "중립",
    shortLabel: "중립",
    emoji: "🟢",
    min: 46,
    max: 60,
    color: "#22c55e",
    tooltipText: "시장 방향성이 불확실한 구간입니다.",
  },
  {
    id: "fear",
    label: "공포",
    shortLabel: "공포",
    emoji: "🔵",
    min: 61,
    max: 75,
    color: "#3b82f6",
    tooltipText: "투자심리가 위축된 구간으로 분할매수를 고려할 수 있습니다.",
  },
  {
    id: "extremeFear",
    label: "극단적 공포",
    shortLabel: "극단적 공포",
    emoji: "🟣",
    min: 76,
    max: 100,
    color: "#a855f7",
    tooltipText: "시장 패닉 구간으로 장기 투자자에게는 기회가 될 수 있습니다.",
  },
]

const LEGEND_ZONE_BOUNDARIES = [0, 16, 31, 46, 61, 76, 100]

/** @param {number} score */
export function resolvePanicIntensityLegendIndex(score) {
  const s = Math.max(0, Math.min(100, Math.round(Number(score))))
  if (s <= 15) return 0
  if (s <= 30) return 1
  if (s <= 45) return 2
  if (s <= 60) return 3
  if (s <= 75) return 4
  return 5
}

/** @returns {typeof PANIC_INTENSITY_LEGEND_STAGES} */
export function panicIntensityLegendStages() {
  return PANIC_INTENSITY_LEGEND_STAGES
}

/** @returns {Array<{ min: number; max: number; color: string; label: string; emoji: string }>} */
export function panicIntensityLegendZoneSteps() {
  return PANIC_INTENSITY_LEGEND_STAGES.map((stage, index) => ({
    min: LEGEND_ZONE_BOUNDARIES[index],
    max: LEGEND_ZONE_BOUNDARIES[index + 1],
    color: stage.color,
    label: stage.label,
    emoji: stage.emoji,
  }))
}

/**
 * @param {number | null | undefined} score
 * @returns {PanicIntensityLegendView | null}
 */
export function buildPanicIntensityLegendView(score) {
  if (score == null || !Number.isFinite(score)) return null
  const rounded = Math.max(0, Math.min(100, Math.round(Number(score))))
  const index = resolvePanicIntensityLegendIndex(rounded)
  const stage = PANIC_INTENSITY_LEGEND_STAGES[index]
  return {
    id: stage.id,
    index,
    label: stage.label,
    shortLabel: stage.shortLabel,
    emoji: stage.emoji,
    min: stage.min,
    max: stage.max,
    color: stage.color,
    rangeLabel: `${stage.min}~${stage.max}`,
    tooltipTitle: `${stage.label} (${stage.min}~${stage.max})`,
    tooltipText: stage.tooltipText,
    score: rounded,
  }
}

/**
 * @param {number | null | undefined} score
 * @returns {string | null}
 */
export function formatPanicIntensityLegendLabel(score) {
  const view = buildPanicIntensityLegendView(score)
  if (!view) return null
  return view.label
}
