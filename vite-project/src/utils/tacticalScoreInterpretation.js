/**
 * 전술 HUD 4카드 — 점수 구간 해석 (높을수록 우호)
 * 0~20 과열 · 20~40 관찰 · 40~60 중립 · 60~80 우호 · 80~100 강매수
 */

/** @typedef {'overheat'|'watch'|'neutral'|'favorable'|'strongBuy'} TacticalScoreBandId */

/** @typedef {'short'|'mid'|'long'|'tactical'} TacticalCardHorizonId */

/**
 * @param {number} score
 * @returns {{ band: TacticalScoreBandId; common: string; arrow: string }}
 */
export function classifyTacticalScoreBand(score) {
  const s = Number(score)
  if (!Number.isFinite(s)) {
    return { band: "neutral", common: "중립", arrow: "→" }
  }
  if (s < 20) return { band: "overheat", common: "추격금지", arrow: "↓" }
  if (s < 40) return { band: "watch", common: "관찰", arrow: "→" }
  if (s < 60) return { band: "neutral", common: "중립", arrow: "→" }
  if (s < 80) return { band: "favorable", common: "우호", arrow: "↑" }
  return { band: "strongBuy", common: "강매수", arrow: "↑" }
}

/** @type {Record<TacticalCardHorizonId, Record<TacticalScoreBandId, string>>} */
const CARD_HINT_BY_BAND = {
  short: {
    overheat: "추격금지",
    watch: "매수관망",
    neutral: "매수중립",
    favorable: "매수우호",
    strongBuy: "강매수",
  },
  mid: {
    overheat: "비중축소",
    watch: "비중관망",
    neutral: "비중중립",
    favorable: "비중확대",
    strongBuy: "비중적극",
  },
  long: {
    overheat: "보유축소",
    watch: "보유관망",
    neutral: "보유중립",
    favorable: "보유우세",
    strongBuy: "보유강화",
  },
  tactical: {
    overheat: "관심보류",
    watch: "관심관찰",
    neutral: "관심유지",
    favorable: "관심추가",
    strongBuy: "관심집중",
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
  const hints = CARD_HINT_BY_BAND[cardId] ?? CARD_HINT_BY_BAND.short
  const hint = hints[band] ?? common

  return {
    score: rounded,
    arrow,
    hint,
    common,
    band,
    line: `${rounded} ${arrow} ${hint}`,
  }
}
