/**
 * YDS Portfolio V5 — 보유 종목 현재가 조회
 */

import { getStockSnapshot } from "./stockPickSnapshotProvider.js"

/** 미국 종목 평가 시 원화 환산 (고정 환율) */
export const PORTFOLIO_USDKRW = 1350

/**
 * 데모·테스트용 고정 현재가 (실 API 연동 전)
 * @type {Record<string, number>}
 */
export const PORTFOLIO_DEMO_CURRENT_PRICES = {
  NVDA: 145,
  "010120": 221_000,
}

/**
 * @typedef {{
 *   id: string
 *   ticker?: string
 *   country?: 'us' | 'kr'
 *   avgUnitPrice?: number
 *   priceReady?: boolean
 * }} PriceLookupLot
 */

/**
 * @param {'us' | 'kr'} country
 * @param {number} localAmount
 */
export function toKrwValue(country, localAmount) {
  const n = Number(localAmount) || 0
  if (n <= 0) return 0
  return country === "us" ? Math.round(n * PORTFOLIO_USDKRW) : Math.round(n)
}

/**
 * @param {string} ticker
 */
function normalizeTicker(ticker) {
  return String(ticker ?? "").trim().toUpperCase()
}

/**
 * @param {PriceLookupLot} lot
 * @returns {number | null}
 */
export function fetchHoldingCurrentPrice(lot) {
  if (!lot.priceReady || !lot.ticker) return null

  const ticker = String(lot.ticker).trim()
  const upper = normalizeTicker(ticker)
  const demo = PORTFOLIO_DEMO_CURRENT_PRICES[upper] ?? PORTFOLIO_DEMO_CURRENT_PRICES[ticker]
  if (demo != null && demo > 0) return demo

  const country = lot.country === "kr" ? "KR" : "US"
  const snapshot = getStockSnapshot({
    ticker,
    country,
    basePrice: lot.avgUnitPrice ?? 100,
  })
  const price = snapshot.price ?? snapshot.close
  return price != null && price > 0 ? price : null
}

/**
 * @param {PriceLookupLot[]} lots
 * @returns {Map<string, number>}
 */
export function resolvePortfolioPrices(lots) {
  /** @type {Map<string, number>} */
  const map = new Map()
  for (const lot of lots) {
    const price = fetchHoldingCurrentPrice(lot)
    if (price != null) map.set(lot.id, price)
  }
  return map
}
