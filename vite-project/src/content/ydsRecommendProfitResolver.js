/**
 * 추천 후 수익률 — 추천가·현재가 해석 및 표시
 */

import { calcRecommendReturnPct } from "../trading-zone/tradingZoneRecommendationTrack.js"
import { isDevMode } from "../utils/devMode.js"
import { daysBetweenPickDates } from "./ydsPickLifecycleEngine.js"
import { todayDateKey } from "./ydsPortfolioTradesStorage.js"

/** @param {unknown} v */
function toPositivePrice(v) {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord | null | undefined} pick
 */
export function resolveLockedRecommendPrice(pick) {
  if (!pick) return null

  const fromField = toPositivePrice(pick.recommendedPrice)
  if (fromField != null) return fromField

  const fromSnap = toPositivePrice(pick.recommendSnapshot?.recommendedPrice)
  if (fromSnap != null) return fromSnap

  const at = String(pick.recommendedAt ?? "").slice(0, 10)
  if (at && pick.priceLog && typeof pick.priceLog === "object") {
    const fromLog = toPositivePrice(pick.priceLog[at])
    if (fromLog != null) return fromLog
  }

  return null
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord | null | undefined} pick
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 */
export function resolveRecommendCurrentPrice(pick, stock) {
  const fromPick = toPositivePrice(pick?.currentPrice)
  if (fromPick != null) return fromPick

  const snap = stock?.snapshot
  const fromStock = toPositivePrice(snap?.price ?? snap?.close)
  if (fromStock != null) return fromStock

  const fromQuote = toPositivePrice(stock?.quote?.price)
  if (fromQuote != null) return fromQuote

  return null
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord | null | undefined} pick
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 */
export function resolveRecommendProfitPct(pick, stock) {
  const recommendPrice = resolveLockedRecommendPrice(pick)
  const currentPrice = resolveRecommendCurrentPrice(pick, stock)

  if (recommendPrice == null || currentPrice == null) return null

  const fromPick =
    pick?.returnPct != null && Number.isFinite(Number(pick.returnPct))
      ? Number(pick.returnPct)
      : null
  const computed = calcRecommendReturnPct(recommendPrice, currentPrice)

  if (fromPick != null && computed != null) {
    if (Math.abs(fromPick - computed) > 0.05) return computed
    return fromPick
  }

  return computed ?? fromPick
}

/**
 * @param {number | null | undefined} returnPct
 * @param {{
 *   daysSinceRecommend?: number | null
 *   hasPrices?: boolean
 *   hasRecommendPrice?: boolean
 *   hasCurrentPrice?: boolean
 * }} [options]
 */
export function formatRecommendProfitLabel(returnPct, options = {}) {
  const {
    daysSinceRecommend,
    hasPrices = true,
    hasRecommendPrice = true,
    hasCurrentPrice = true,
  } = options
  if (!hasRecommendPrice) return "—"
  if (!hasCurrentPrice) return "계산 불가"
  if (daysSinceRecommend === 0) return "측정 시작 전"
  if (!hasPrices || returnPct == null || !Number.isFinite(returnPct)) return "계산 불가"
  return `${returnPct > 0 ? "+" : ""}${returnPct.toFixed(1)}%`
}

/** @param {number | null | undefined} returnPct @param {{ daysSinceRecommend?: number | null; hasRecommendPrice?: boolean; hasCurrentPrice?: boolean }} [options] */
export function resolveRecommendProfitTone(returnPct, options = {}) {
  const { daysSinceRecommend, hasRecommendPrice = true, hasCurrentPrice = true } = options
  if (!hasRecommendPrice || !hasCurrentPrice) return "muted"
  if (daysSinceRecommend === 0) return "pending"
  if (returnPct == null || !Number.isFinite(returnPct)) return "muted"
  if (returnPct === 0) return "muted"
  return returnPct > 0 ? "up" : "down"
}

/**
 * @param {{
 *   ticker: string
 *   recommendPrice: number | null
 *   currentPrice: number | null
 *   profitPercent: number | null
 *   source?: string | null
 *   stage?: string
 * }} payload
 */
export function logRecommendProfitTrace(payload) {
  if (!isDevMode()) return
  console.info(
    "[recommend-profit]",
    JSON.stringify({
      ticker: payload.ticker,
      recommendPrice: payload.recommendPrice,
      currentPrice: payload.currentPrice,
      profitPercent: payload.profitPercent,
      source: payload.source ?? null,
      stage: payload.stage ?? "refresh",
    }),
  )
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord | null | undefined} pick
 */
export function buildRecommendProfitView(stock, pick) {
  const recommendPrice = resolveLockedRecommendPrice(pick)
  const currentPrice = resolveRecommendCurrentPrice(pick, stock)
  const returnPct = resolveRecommendProfitPct(pick, stock)
  const recommendedAt = pick?.recommendedAt ? String(pick.recommendedAt).slice(0, 10) : null
  const daysSinceRecommend = recommendedAt ? daysBetweenPickDates(recommendedAt, todayDateKey()) : null
  const hasRecommendPrice = recommendPrice != null
  const hasCurrentPrice = currentPrice != null
  const hasPrices = hasRecommendPrice && hasCurrentPrice
  const profitOptions = {
    daysSinceRecommend,
    hasPrices,
    hasRecommendPrice,
    hasCurrentPrice,
  }

  return {
    recommendPrice,
    currentPrice,
    returnPct,
    daysSinceRecommend,
    returnLabel: formatRecommendProfitLabel(returnPct, profitOptions),
    returnTone: resolveRecommendProfitTone(returnPct, profitOptions),
    canCalculate: hasPrices,
  }
}
