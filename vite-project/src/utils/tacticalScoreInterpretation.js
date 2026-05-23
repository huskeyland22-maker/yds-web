/**
 * 전술 HUD 4카드 — 점수 구간별 투자 행동 문구 (높을수록 우호)
 * 0~19 · 20~39 · 40~59 · 60~79 · 80~100
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
  if (s >= 80) return { band: "strongBuy", common: "강세", arrow: "↑" }
  if (s >= 60) return { band: "favorable", common: "우호", arrow: "↑" }
  if (s >= 40) return { band: "neutral", common: "중립", arrow: "→" }
  if (s >= 20) return { band: "watch", common: "경계", arrow: "→" }
  return { band: "overheat", common: "위험", arrow: "↓" }
}

/** @type {Record<TacticalCardHorizonId, Record<TacticalScoreBandId, string>>} */
const CARD_ACTION_BY_BAND = {
  short: {
    strongBuy: "적극매수",
    favorable: "매수우호",
    neutral: "중립",
    watch: "경계",
    overheat: "위험",
  },
  mid: {
    strongBuy: "풀비중",
    favorable: "비중확대",
    neutral: "중립비중",
    watch: "비중축소",
    overheat: "현금우위",
  },
  long: {
    strongBuy: "장기강세",
    favorable: "보유우위",
    neutral: "중립",
    watch: "방어",
    overheat: "위험",
  },
  tactical: {
    strongBuy: "강한관심",
    favorable: "관심유지",
    neutral: "관망",
    watch: "경계",
    overheat: "제외",
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
    line: `${rounded} ${arrow} ${hint}`,
  }
}
