/**
 * 전술 HUD 4카드 — 점수 구간별 투자 행동 문구 (높을수록 우호)
 * 0~19 · 20~39 · 40~59 · 60~79 · 80~100
 */

/** @typedef {'overheat'|'watch'|'neutral'|'favorable'|'strongBuy'} TacticalScoreBandId */

/** @typedef {'short'|'mid'|'long'|'tactical'} TacticalCardHorizonId */

/** 점수 구간 범례 (카드 하단) */
export const TACTICAL_SCORE_LEGEND = [
  "80↑ 강세",
  "60~79 우호",
  "40~59 중립",
  "20~39 경계",
  "0~19 위험",
]

/**
 * @param {number} score
 * @returns {{ band: TacticalScoreBandId; common: string; arrow: string }}
 */
export function classifyTacticalScoreBand(score) {
  const s = Number(score)
  if (!Number.isFinite(s)) {
    return { band: "neutral", common: "중립", arrow: "→" }
  }
  if (s >= 80) return { band: "strongBuy", common: "강세", arrow: "↑" }
  if (s >= 60) return { band: "favorable", common: "우호", arrow: "↑" }
  if (s >= 40) return { band: "neutral", common: "중립", arrow: "→" }
  if (s >= 20) return { band: "watch", common: "경계", arrow: "→" }
  return { band: "overheat", common: "위험", arrow: "↓" }
}

/** @type {Record<TacticalCardHorizonId, Record<TacticalScoreBandId, string>>} */
const CARD_ACTION_BY_BAND = {
  short: {
    strongBuy: "눌림 우세",
    favorable: "눌림 우세",
    neutral: "눌림 대기",
    watch: "추격 제한",
    overheat: "추격 제한",
  },
  mid: {
    strongBuy: "선별 대응",
    favorable: "선별 대응",
    neutral: "선별 대기",
    watch: "리스크 관리",
    overheat: "리스크 관리",
  },
  long: {
    strongBuy: "고점 경계",
    favorable: "고점 경계",
    neutral: "밸류 점검",
    watch: "방어 우선",
    overheat: "방어 우선",
  },
  tactical: {
    strongBuy: "분할 대응",
    favorable: "추격 제한",
    neutral: "관망 유지",
    watch: "추격 제한",
    overheat: "진입 제한",
  },
}

/**
 * @param {TacticalCardHorizonId} cardId
 * @param {number | null | undefined} score
 * @returns {{
 *   score: number
 *   arrow: string
 *   hint: string
 *   common: string
 *   band: TacticalScoreBandId
 *   line: string
 * } | null}
 */
export function buildTacticalScoreBottomLine(cardId, score) {
  const n = Number(score)
  if (!Number.isFinite(n)) return null

  const rounded = Math.round(n)
  const { band, common, arrow } = classifyTacticalScoreBand(rounded)
  const actions = CARD_ACTION_BY_BAND[cardId] ?? CARD_ACTION_BY_BAND.short
  const hint = actions[band] ?? common

  return {
    score: rounded,
    arrow,
    hint,
    common,
    band,
    line: `${rounded} | ${hint}`,
  }
}
