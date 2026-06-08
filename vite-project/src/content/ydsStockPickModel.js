/**
 * YDS Phase 2-2 — 종목추천 데이터 모델 (더미 · UI 전용)
 */

import universe from "../data/stockPickUniverse.json" with { type: "json" }
import {
  formatScoreBreakdownRows,
  normalizeScoreBreakdown,
  YDS_SCORE_WEIGHTS,
} from "./ydsStockScoreConfig.js"

/** @typedef {'trend' | 'dip' | 'interest' | 'overheat'} StockPickStatusId */
/** @typedef {'ai' | 'power' | 'defense' | 'semi' | 'robot' | 'nuclear' | 'infra'} StockPickSectorId */

export { YDS_SCORE_WEIGHTS }

export const STOCK_PICK_STATUS = {
  trend: { id: "trend", emoji: "🟢", label: "추세", phrase: "강한 추세" },
  dip: { id: "dip", emoji: "🟡", label: "눌림", phrase: "눌림 대기" },
  interest: { id: "interest", emoji: "🟠", label: "관심", phrase: "관심 구간" },
  overheat: { id: "overheat", emoji: "🔴", label: "과열", phrase: "과열 구간" },
}

export const STOCK_PICK_SECTORS = [
  { id: "all", label: "전체" },
  { id: "ai", label: "AI" },
  { id: "power", label: "전력" },
  { id: "defense", label: "방산" },
  { id: "semi", label: "반도체" },
  { id: "nuclear", label: "원전" },
  { id: "robot", label: "로봇" },
  { id: "infra", label: "인프라" },
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
 *   rank: number
 *   comment: string
 *   trendScore: number
 *   volumeScore: number
 *   positionScore: number
 *   marketFitScore: number
 *   totalScore: number
 * }} StockPickRecord
 */

/**
 * @typedef {StockPickRecord & {
 *   id: string
 *   stars: string
 *   score: number
 *   scores: import("./ydsStockScoreConfig.js").YdsScoreBreakdown
 *   scoreRows: ReturnType<typeof formatScoreBreakdownRows>
 *   statusView: typeof STOCK_PICK_STATUS[keyof typeof STOCK_PICK_STATUS]
 *   statusPhrase: string
 *   sectorLabel: string
 * }} StockPickView
 */

/** @param {StockPickRecord} row */
function enrichStock(row) {
  const statusView = STOCK_PICK_STATUS[row.status] ?? STOCK_PICK_STATUS.interest
  const sectorLabel =
    STOCK_PICK_SECTORS.find((s) => s.id === row.sector)?.label ?? row.sector
  const scores =
    normalizeScoreBreakdown({
      trendScore: row.trendScore,
      volumeScore: row.volumeScore,
      positionScore: row.positionScore,
      marketFitScore: row.marketFitScore,
      totalScore: row.totalScore,
    }) ?? {
      trendScore: 0,
      volumeScore: 0,
      positionScore: 0,
      marketFitScore: 0,
      totalScore: row.totalScore ?? 0,
    }

  return {
    ...row,
    id: row.ticker,
    stars: RATING_STARS[row.rating] ?? RATING_STARS[3],
    score: scores.totalScore,
    scores,
    scoreRows: formatScoreBreakdownRows(scores),
    statusView,
    statusPhrase: statusView.phrase,
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

/** @typedef {'totalScore' | 'trendScore' | 'volumeScore' | 'positionScore' | 'marketFitScore' | 'rating' | 'rank' | 'name'} StockPickSortKey */

/**
 * @param {StockPickView[]} stocks
 * @param {StockPickSortKey} key
 * @param {'asc' | 'desc'} dir
 */
export function sortStockPicks(stocks, key, dir = "desc") {
  const mul = dir === "asc" ? 1 : -1
  return [...stocks].sort((a, b) => {
    if (key === "name") return mul * a.name.localeCompare(b.name, "ko")
    const legacy = key === "totalScore" ? "score" : key
    const av = a[legacy] ?? a[key] ?? 0
    const bv = b[legacy] ?? b[key] ?? 0
    return mul * (Number(av) - Number(bv))
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
