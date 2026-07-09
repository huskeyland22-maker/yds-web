/**
 * 메인 대시보드 추천 종목 카드 — 검증 스냅샷 연동
 */

import { findValidationPickByTicker } from "./ydsPickValidationLink.js"
import { buildRecommendProfitView } from "./ydsRecommendProfitResolver.js"
import { formatTransparencyPrice } from "./ydsStockPickTransparency.js"

/**
 * @typedef {{
 *   id: 'active' | 'd7' | 'd14' | 'd30'
 *   label: string
 * }} PickValidationBadge
 */

/**
 * @typedef {{
 *   badge: PickValidationBadge
 *   recommendedPrice: number | null
 *   recommendedPriceDisplay: string
 *   currentPriceDisplay: string
 *   returnSinceRecommend: number | null
 *   returnLabel: string
 *   returnTone: string
 *   daysSinceRecommend: number | null
 * }} StockPickDeskPreview
 */

/** @param {string} start @param {string} end */
function daysSince(start, end) {
  const d0 = new Date(`${start}T12:00:00`)
  const d1 = new Date(`${end}T12:00:00`)
  return Math.max(0, Math.round((d1.getTime() - d0.getTime()) / 86400000))
}

/** @param {number | null} days */
function resolveValidationBadge(days) {
  if (days == null) {
    return { id: /** @type {const} */ ("active"), label: "🟢 추천 진행중" }
  }
  if (days < 7) {
    return { id: /** @type {const} */ ("active"), label: "🟢 추천 진행중" }
  }
  if (days < 14) {
    return { id: /** @type {const} */ ("d7"), label: "🔵 7일 검증중" }
  }
  if (days < 30) {
    return { id: /** @type {const} */ ("d14"), label: "🟡 14일 검증중" }
  }
  return { id: /** @type {const} */ ("d30"), label: "🟣 30일 검증중" }
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 * @param {string} [today]
 */
export function buildStockPickDeskPreview(stock, today = new Date().toISOString().slice(0, 10)) {
  const country = stock.country === "KR" ? "KR" : "US"
  const match = findValidationPickByTicker(stock.ticker, country)
  const profit = buildRecommendProfitView(stock, match)
  const currentPriceDisplay =
    profit.currentPrice != null ? formatTransparencyPrice(profit.currentPrice, country) : "—"
  const recommendedPrice = profit.recommendPrice
  const recommendedPriceDisplay =
    recommendedPrice != null ? formatTransparencyPrice(recommendedPrice, country) : "—"

  const days =
    match?.recommendedAt != null ? daysSince(match.recommendedAt, today) : profit.daysSinceRecommend
  const badge = resolveValidationBadge(days)

  return {
    badge,
    recommendedPrice,
    recommendedPriceDisplay,
    currentPriceDisplay,
    returnSinceRecommend: profit.returnPct,
    returnLabel: profit.returnLabel,
    returnTone: profit.returnTone,
    daysSinceRecommend: days,
  }
}
