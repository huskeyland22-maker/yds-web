/**
 * 패닉 강도 구간별 해석 · 행동 가이드 (투자 판단용 카피)
 */

/** @typedef {'overheat' | 'lowFear' | 'neutral' | 'fear' | 'panic'} PanicInterpretBandId */

/**
 * @typedef {{
 *   id: PanicInterpretBandId
 *   label: string
 *   interpretationLines: string[]
 *   actionGuide: string | null
 * }} PanicIntensityInterpretation
 */

/** @param {number} score */
export function resolvePanicInterpretBandId(score) {
  const s = Math.max(0, Math.min(100, Math.round(Number(score))))
  if (s <= 20) return /** @type {const} */ ("overheat")
  if (s <= 40) return /** @type {const} */ ("lowFear")
  if (s <= 60) return /** @type {const} */ ("neutral")
  if (s <= 80) return /** @type {const} */ ("fear")
  return /** @type {const} */ ("panic")
}

/** @type {Record<PanicInterpretBandId, Omit<PanicIntensityInterpretation, 'id'>>} */
const PANIC_INTERPRET_COPY = {
  overheat: {
    label: "과열",
    interpretationLines: [
      "시장 낙관이 과도한 상태",
      "신규 진입보다",
      "수익 보호가 중요한 구간",
    ],
    actionGuide: "추격매수 주의",
  },
  lowFear: {
    label: "공포 부족",
    interpretationLines: ["시장 심리가 낙관적", "단기 과열 가능성 존재"],
    actionGuide: "분할 접근 권장",
  },
  neutral: {
    label: "중립",
    interpretationLines: ["시장 심리가 균형 상태", "실적과 추세 중심 접근"],
    actionGuide: null,
  },
  fear: {
    label: "공포",
    interpretationLines: [
      "투자심리가 위축된 상태",
      "관심종목 분할매수 구간",
      "역사적으로 기대수익률 개선 구간",
    ],
    actionGuide: null,
  },
  panic: {
    label: "패닉",
    interpretationLines: [
      "시장 전반에 투매 심리 발생",
      "우량주 집중 매수 기회",
      "과도한 비관 국면",
    ],
    actionGuide: null,
  },
}

/** @param {number | null | undefined} score */
export function buildPanicIntensityInterpretation(score) {
  if (score == null || !Number.isFinite(score)) return null
  const id = resolvePanicInterpretBandId(score)
  const copy = PANIC_INTERPRET_COPY[id]
  return { id, ...copy }
}
