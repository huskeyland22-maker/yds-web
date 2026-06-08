/**
 * 종목추천 시세 — Portfolio Quote Provider 재사용 (/api/portfolio-quote)
 */

import universe from "../data/stockPickUniverse.json" with { type: "json" }
import { fetchPortfolioQuotes } from "./ydsPortfolioPriceProviders.js"
import { formatQuoteUpdatedAt } from "./ydsPortfolioQuoteTypes.js"

/** @typedef {import("./ydsPortfolioQuoteTypes.js").PortfolioQuote} PortfolioQuote */

/**
 * @typedef {{
 *   price: number
 *   change: number | null
 *   changePct: number | null
 *   currency: 'USD' | 'KRW'
 *   updatedAt: string | null
 *   status: PortfolioQuote['status']
 *   stale?: boolean
 *   source?: string
 * }} StockPickQuoteView
 */

/** @param {unknown} v */
function toNum(v) {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * @param {PortfolioQuote | null | undefined} quote
 * @param {'US' | 'KR'} country
 * @returns {StockPickQuoteView | null}
 */
export function portfolioQuoteToPickView(quote, country) {
  if (!quote?.price || quote.price <= 0) return null
  const change = toNum(quote.change)
  const changePct =
    change != null && quote.price > 0
      ? (change / (quote.price - change)) * 100
      : null

  return {
    price: quote.price,
    change,
    changePct: changePct != null && Number.isFinite(changePct) ? changePct : null,
    currency: country === "KR" ? "KRW" : "USD",
    updatedAt: quote.updatedAt ?? null,
    status: quote.status ?? "delayed",
    stale: quote.stale,
    source: quote.source,
  }
}

/**
 * @param {object | null | undefined} apiBody
 * @param {'US' | 'KR'} country
 * @returns {StockPickQuoteView | null}
 */
export function apiBodyToPickQuote(apiBody, country) {
  if (!apiBody) return null
  const ps = apiBody.priceSummary ?? {}
  const price = toNum(ps.todayClose ?? ps.headlinePrice ?? apiBody.price ?? apiBody.regularClose)
  if (price == null || price <= 0) return null

  const changePct = toNum(ps.changePct)
  const changeAmount = toNum(ps.changeAmount)
  const change =
    changeAmount ??
    (changePct != null && price > 0 ? (price * changePct) / (100 + changePct) : null)

  return {
    price,
    change,
    changePct,
    currency: country === "KR" ? "KRW" : "USD",
    updatedAt: apiBody.updatedAt ?? apiBody.asOf ?? null,
    status: apiBody.dataSource === "kis" ? "live" : "delayed",
    source: apiBody.dataSource,
  }
}

/**
 * @param {PortfolioQuote | null | undefined} portfolioQuote
 * @param {object | null | undefined} apiBody
 * @param {'US' | 'KR'} country
 * @returns {StockPickQuoteView | null}
 */
export function mergePickQuote(portfolioQuote, apiBody, country) {
  return (
    portfolioQuoteToPickView(portfolioQuote, country) ??
    apiBodyToPickQuote(apiBody, country)
  )
}

/**
 * @returns {Promise<{ quotes: Map<string, StockPickQuoteView>; fetchedAt: string | null }>}
 */
export async function fetchStockPickQuotesBatch() {
  const lots = universe.stocks.map((row) => ({
    id: row.ticker,
    ticker: row.ticker,
    country: row.country === "KR" ? "kr" : "us",
    priceReady: true,
  }))

  const result = await fetchPortfolioQuotes(lots)
  /** @type {Map<string, StockPickQuoteView>} */
  const quotes = new Map()

  for (const row of universe.stocks) {
    const raw = result.quoteMap.get(row.ticker)
    const view = portfolioQuoteToPickView(raw, row.country)
    if (view) quotes.set(row.ticker, view)
  }

  return { quotes, fetchedAt: result.fetchedAt }
}

/**
 * @param {number | null | undefined} price
 * @param {'US' | 'KR'} country
 */
export function formatPickPrice(price, country) {
  if (price == null || !Number.isFinite(price)) return "—"
  if (country === "KR") return `${Math.round(price).toLocaleString("ko-KR")}원`
  if (price >= 1000) return `$${Math.round(price).toLocaleString("en-US")}`
  if (price >= 100) return `$${price.toFixed(1)}`
  return `$${price.toFixed(2)}`
}

/**
 * @param {number | null | undefined} changePct
 */
export function formatPickChangePct(changePct) {
  if (changePct == null || !Number.isFinite(changePct)) return "—"
  const sign = changePct > 0 ? "+" : ""
  return `${sign}${changePct.toFixed(2)}%`
}

export { formatQuoteUpdatedAt }
