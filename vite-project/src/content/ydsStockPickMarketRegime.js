/**
 * V6 — 시장상태(9패닉) 연동 · 노출 한도 · 추천 문구
 */

/** @typedef {import("../panic-v2/panicMacroV1Status.js").MacroV1StatusId} MacroV1StatusId */

/** @type {Record<MacroV1StatusId, number>} */
export const REGIME_DISPLAY_LIMITS = {
  overheated: 5,
  neutral: 20,
  interest: 30,
  dca: 50,
  panicBuy: Infinity,
}

/** @type {Record<MacroV1StatusId, string>} */
export const REGIME_RECOMMENDATION_COPY = {
  overheated: "과열 구간 — TOP5 핵심 종목만 집중",
  neutral: "중립 구간 — TOP20 유망 종목 탐색",
  interest: "관심 구간 진입, 유망 종목 탐색 시작",
  dca: "분할진입 구간, 우량주 집중 매수",
  panicBuy: "패닉매수 구간, 공격적 종목 발굴",
}

/**
 * @param {MacroV1StatusId | string | undefined} macroId
 * @returns {number}
 */
export function getRegimeDisplayLimit(macroId) {
  const id = /** @type {MacroV1StatusId} */ (macroId ?? "neutral")
  return REGIME_DISPLAY_LIMITS[id] ?? REGIME_DISPLAY_LIMITS.neutral
}

/**
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null | undefined} ctx
 * @returns {string}
 */
export function getRegimeRecommendationLine(ctx) {
  if (!ctx?.ready) return ""
  const copy = REGIME_RECOMMENDATION_COPY[ctx.macroId] ?? REGIME_RECOMMENDATION_COPY.neutral
  if (ctx.contextLine) return `${copy} · ${ctx.contextLine}`
  return copy
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView[]} stocks
 * @param {number} limit
 */
export function getRegimeTopStocks(stocks, limit) {
  const sorted = [...stocks].sort((a, b) => (a.rank || 999) - (b.rank || 999))
  if (!Number.isFinite(limit)) return sorted
  return sorted.slice(0, limit)
}
