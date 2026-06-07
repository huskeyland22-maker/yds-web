/**
 * YDS Phase 2-1 — 종목추천 데이터 모델 (더미 · UI 전용)
 */

import universe from "../data/stockPickUniverse.json" with { type: "json" }

/** @typedef {'trend' | 'dip' | 'interest' | 'overheat'} StockPickStatusId */
/** @typedef {'ai' | 'power' | 'defense' | 'semi' | 'robot'} StockPickSectorId */

export const STOCK_PICK_STATUS = {
  trend: { id: "trend", emoji: "🟢", label: "추세" },
  dip: { id: "dip", emoji: "🟡", label: "눌림" },
  interest: { id: "interest", emoji: "🟠", label: "관심" },
  overheat: { id: "overheat", emoji: "🔴", label: "과열" },
}

export const STOCK_PICK_SECTORS = [
  { id: "all", label: "전체" },
  { id: "ai", label: "AI" },
  { id: "power", label: "전력" },
  { id: "defense", label: "방산" },
  { id: "semi", label: "반도체" },
  { id: "robot", label: "로봇" },
]

/** @type {Record<number, string>} */
export const RATING_STARS = {
  5: "★★★★★",
  4: "★★★★☆",
  3: "★★★☆☆",
  2: "★★☆☆☆",
  1: "★☆☆☆☆",
}

/**
 * @typedef {{
 *   ticker: string
 *   name: string
 *   nameEn: string
 *   sector: StockPickSectorId
 *   country: 'US' | 'KR'
 *   status: StockPickStatusId
 *   rating: number
 *   score: number
 *   rank: number
 *   comment: string
 * }} StockPickRecord
 */

/**
 * @typedef {StockPickRecord & {
 *   id: string
 *   stars: string
 *   statusView: typeof STOCK_PICK_STATUS[keyof typeof STOCK_PICK_STATUS]
 *   sectorLabel: string
 * }} StockPickView
 */

/** @param {StockPickRecord} row */
function enrichStock(row) {
  const statusView = STOCK_PICK_STATUS[row.status] ?? STOCK_PICK_STATUS.interest
  const sectorLabel =
    STOCK_PICK_SECTORS.find((s) => s.id === row.sector)?.label ?? row.sector
  return {
    ...row,
    id: row.ticker,
    stars: RATING_STARS[row.rating] ?? RATING_STARS[3],
    statusView,
    sectorLabel,
  }
}

/** @returns {StockPickView[]} */
export function getStockPickUniverse() {
  return universe.stocks.map(enrichStock).sort((a, b) => a.rank - b.rank)
}

/** @param {string} ticker */
export function getStockPickByTicker(ticker) {
  const key = String(ticker ?? "").toUpperCase()
  return getStockPickUniverse().find((s) => s.ticker.toUpperCase() === key) ?? null
}

/** @typedef {'score' | 'rating' | 'rank' | 'name'} StockPickSortKey */

/**
 * @param {StockPickView[]} stocks
 * @param {StockPickSortKey} key
 * @param {'asc' | 'desc'} dir
 */
export function sortStockPicks(stocks, key, dir = "desc") {
  const mul = dir === "asc" ? 1 : -1
  return [...stocks].sort((a, b) => {
    if (key === "name") return mul * a.name.localeCompare(b.name, "ko")
    return mul * ((a[key] ?? 0) - (b[key] ?? 0))
  })
}

/** @param {StockPickView[]} stocks */
export function getTop3Stocks(stocks) {
  return sortStockPicks(stocks, "rank", "asc").slice(0, 3)
}

/** @param {StockPickView[]} stocks */
export function getRankingStocks(stocks, limit = 5) {
  return sortStockPicks(stocks, "rank", "asc").slice(0, limit)
}

/** @param {StockPickView[]} stocks @param {string} sectorId */
export function filterBySector(stocks, sectorId) {
  if (!sectorId || sectorId === "all") return stocks
  return stocks.filter((s) => s.sector === sectorId)
}

export const TOP3_MEDALS = ["🥇", "🥈", "🥉"]
