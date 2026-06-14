/**
 * V6 — 시장상태 연동 · 노출 한도 · 추천 문구
 * V6.1 — 시장 위치(과열→충격) 중심, 패닉 강도는 보조
 */

import {
  getMarketStatePickLimit,
  MARKET_STATE_STRATEGY,
} from "./ydsMarketStateCenter.js"

/** @typedef {import("../panic-v2/panicMacroV1Status.js").MacroV1StatusId} MacroV1StatusId */
/** @typedef {import("./ydsMarketPositionEngine.js").MarketPositionId} MarketPositionId */

/** @deprecated macroId 기반 — marketPositionId 우선 사용 */
export const REGIME_DISPLAY_LIMITS = {
  overheated: 5,
  neutral: 10,
  interest: 20,
  dca: 50,
  panicBuy: Infinity,
}

/** @type {Record<MarketPositionId, string>} */
export const MARKET_POSITION_RECOMMENDATION_COPY = Object.fromEntries(
  Object.entries(MARKET_STATE_STRATEGY).map(([id, block]) => [id, block.headline]),
)

/** @type {Record<MacroV1StatusId, string>} */
export const REGIME_RECOMMENDATION_COPY = {
  overheated: "과열 구간 — TOP5 핵심 종목만 집중",
  neutral: "경계 구간 — TOP10 선별 관찰",
  interest: "조정 구간 — TOP20 유망 종목 탐색",
  dca: "위축 구간 — TOP50 우량주 집중",
  panicBuy: "충격 구간 — 전체 공개 · 공격적 발굴",
}

/**
 * @param {MarketPositionId | MacroV1StatusId | string | undefined} id
 * @param {"position" | "macro"} [mode]
 * @returns {number}
 */
export function getRegimeDisplayLimit(id, mode = "position") {
  if (mode === "macro") {
    const macroId = /** @type {MacroV1StatusId} */ (id ?? "neutral")
    return REGIME_DISPLAY_LIMITS[macroId] ?? REGIME_DISPLAY_LIMITS.neutral
  }
  return getMarketStatePickLimit(id)
}

/**
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null | undefined} ctx
 * @returns {string}
 */
export function getRegimeRecommendationLine(ctx) {
  if (!ctx?.ready) return ""
  const copy =
    (ctx.marketPositionId
      ? MARKET_POSITION_RECOMMENDATION_COPY[/** @type {MarketPositionId} */ (ctx.marketPositionId)]
      : null) ??
    REGIME_RECOMMENDATION_COPY[ctx.macroId] ??
    REGIME_RECOMMENDATION_COPY.neutral
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
