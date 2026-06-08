/**
 * YDS Portfolio — 종목 검색·자동완성 카탈로그
 */

import stockPickUniverse from "../data/stockPickUniverse.json" with { type: "json" }

/**
 * @typedef {{
 *   id: string
 *   name: string
 *   nameEn: string
 *   ticker: string
 *   country: 'us' | 'kr'
 * }} PortfolioStockOption
 */

/** 종목추천 유니버스 외 포트폴리오 검색 보강 */
const EXTRA_STOCKS = [
  { ticker: "005380", name: "현대차", nameEn: "Hyundai Motor", country: "KR" },
  { ticker: "012330", name: "현대모비스", nameEn: "Hyundai Mobis", country: "KR" },
  { ticker: "000720", name: "현대건설", nameEn: "Hyundai E&C", country: "KR" },
]

/**
 * @param {string} country
 * @returns {'us' | 'kr'}
 */
function toCountryId(country) {
  return String(country).toUpperCase() === "KR" ? "kr" : "us"
}

/**
 * @param {{ ticker: string, name: string, nameEn?: string, country: string }} raw
 * @returns {PortfolioStockOption}
 */
function toOption(raw) {
  const ticker = String(raw.ticker ?? "").trim()
  return {
    id: `${toCountryId(raw.country)}-${ticker}`,
    name: String(raw.name ?? "").trim(),
    nameEn: String(raw.nameEn ?? "").trim(),
    ticker,
    country: toCountryId(raw.country),
  }
}

/** @type {PortfolioStockOption[]} */
const CATALOG = (() => {
  /** @type {Map<string, PortfolioStockOption>} */
  const map = new Map()

  for (const stock of stockPickUniverse.stocks ?? []) {
    const opt = toOption(stock)
    if (!opt.ticker || !opt.name) continue
    map.set(opt.id, opt)
  }

  for (const stock of EXTRA_STOCKS) {
    const opt = toOption(stock)
    if (!opt.ticker || !opt.name) continue
    map.set(opt.id, opt)
  }

  return Array.from(map.values())
})()

export { CATALOG as PORTFOLIO_STOCK_CATALOG }

/**
 * @param {string} query
 */
function normalizeQuery(query) {
  return String(query ?? "").trim().toLowerCase()
}

/**
 * @param {PortfolioStockOption} entry
 * @param {string} q
 */
function matchScore(entry, q) {
  if (!q) return 0

  const name = entry.name.toLowerCase()
  const nameEn = entry.nameEn.toLowerCase()
  const ticker = entry.ticker.toLowerCase()

  if (name.startsWith(q) || nameEn.startsWith(q)) return 100
  if (name.includes(q) || nameEn.includes(q)) return 80
  if (ticker.startsWith(q)) return 70
  if (ticker.includes(q)) return 50
  return 0
}

/**
 * @param {string} query
 * @param {number} [limit]
 * @returns {PortfolioStockOption[]}
 */
export function searchPortfolioStocks(query, limit = 8) {
  const q = normalizeQuery(query)
  if (!q) return []

  return CATALOG.filter((entry) => matchScore(entry, q) > 0)
    .sort((a, b) => {
      const diff = matchScore(b, q) - matchScore(a, q)
      if (diff !== 0) return diff
      return a.name.localeCompare(b.name, "ko")
    })
    .slice(0, limit)
}

/**
 * @param {string} ticker
 * @param {'us' | 'kr'} country
 * @returns {PortfolioStockOption | null}
 */
export function findPortfolioStockByTicker(ticker, country) {
  const t = String(ticker ?? "").trim()
  if (!t) return null
  return CATALOG.find((s) => s.ticker === t && s.country === country) ?? null
}
