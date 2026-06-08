/**
 * YDS Phase 2-6 — 종목추천 데이터 모델 (점수 · 행동 · 추천 이유)
 */

import universe from "../data/stockPickUniverse.json" with { type: "json" }
import { deriveStockAction } from "./ydsStockActionEngine.js"
import {
  buildRecommendReasons,
  formatRecommendReasonSummary,
} from "./ydsStockRecommendReasons.js"
import {
  buildMarketFitReasons,
  computeMarketFitScore,
} from "./ydsMarketAdapter.js"
import { getStockSnapshot, toEngineSnapshot } from "./stockPickSnapshotProvider.js"
import { computeStockScores } from "./ydsStockScoreEngine.js"
import {
  formatScoreBreakdownRows,
  normalizeScoreBreakdown,
  YDS_SCORE_WEIGHTS,
} from "./ydsStockScoreConfig.js"

/** @typedef {'trend' | 'dip' | 'interest' | 'overheat'} StockPickStatusId */
/** @typedef {'ai' | 'power' | 'defense' | 'semi' | 'robot' | 'nuclear' | 'infra'} StockPickSectorId */

export { YDS_SCORE_WEIGHTS }

export {
  STOCK_ACTION_VIEWS,
  STOCK_STATUS_VIEWS,
} from "./ydsStockActionEngine.js"

/** @deprecated JSON status — 화면은 deriveStockAction 결과 사용 */
export const STOCK_PICK_STATUS = {
  trend: { id: "trend", emoji: "🟢", label: "추세 유지", phrase: "추세 유지" },
  dip: { id: "dip", emoji: "🟡", label: "눌림 대기", phrase: "눌림 대기" },
  interest: { id: "interest", emoji: "🟠", label: "관심 구간", phrase: "관심 구간" },
  overheat: { id: "overheat", emoji: "🔴", label: "과열 구간", phrase: "과열 구간" },
}

/** @typedef {'US' | 'KR'} StockPickCountryId */

export const STOCK_PICK_COUNTRIES = [
  { id: "US", emoji: "🇺🇸", label: "미국" },
  { id: "KR", emoji: "🇰🇷", label: "한국" },
]

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
 *   comment: string
 *   marketFitScore: number
 * }} StockPickRecord
 */

/**
 * @typedef {StockPickRecord & {
 *   id: string
 *   rank: number
 *   stars: string
 *   score: number
 *   scores: import("./ydsStockScoreConfig.js").YdsScoreBreakdown
 *   scoreRows: ReturnType<typeof formatScoreBreakdownRows>
 *   scoreMeta: import("./ydsStockScoreEngine.js").StockScoreComputeMeta
 *   statusView: import("./ydsStockActionEngine.js").StockStatusView
 *   statusPhrase: string
 *   stockStatus: import("./ydsStockActionEngine.js").StockStatusView
 *   stockAction: import("./ydsStockActionEngine.js").StockActionView
 *   actionReason: string
 *   recommendReasons: import("./ydsStockRecommendReasons.js").RecommendReason[]
 *   recommendReasonSummary: string
 *   marketFitSource: 'adapter' | 'manual'
 *   sectorLabel: string
 * }} StockPickView
 */

/**
 * @param {StockPickRecord} row
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null} [marketContext]
 */
function enrichStock(row, marketContext = null) {
  const sectorLabel =
    STOCK_PICK_SECTORS.find((s) => s.id === row.sector)?.label ?? row.sector

  const ctx = marketContext?.ready ? marketContext : null

  const marketSnapshot = getStockSnapshot({
    ticker: row.ticker,
    country: row.country,
    status: row.status,
  })
  const computed = computeStockScores(toEngineSnapshot(marketSnapshot), {
    marketFitScore: 0,
  })

  const baseScores =
    normalizeScoreBreakdown(computed.scores) ?? {
      trendScore: 0,
      volumeScore: 0,
      positionScore: 0,
      marketFitScore: 0,
      totalScore: 0,
    }

  const draftReasons = buildRecommendReasons(baseScores, computed.meta, {
    limit: 3,
    skipMarketFit: true,
  })
  const action = deriveStockAction(baseScores, computed.meta, draftReasons)

  const marketFitScore = ctx
    ? computeMarketFitScore(ctx, action.statusId, baseScores)
    : row.marketFitScore ?? 0

  const scores =
    normalizeScoreBreakdown({
      trendScore: baseScores.trendScore,
      volumeScore: baseScores.volumeScore,
      positionScore: baseScores.positionScore,
      marketFitScore,
    }) ?? baseScores

  const marketFitReasons = ctx
    ? buildMarketFitReasons(ctx, action.statusId, marketFitScore)
    : []

  const recommendReasons = buildRecommendReasons(scores, computed.meta, {
    limit: 4,
    skipMarketFit: Boolean(ctx),
    marketFitReasons,
  })

  return {
    ...row,
    id: row.ticker,
    rank: 0,
    stars: RATING_STARS[row.rating] ?? RATING_STARS[3],
    score: scores.totalScore,
    scores,
    scoreRows: formatScoreBreakdownRows(scores),
    scoreMeta: computed.meta,
    snapshot: marketSnapshot,
    statusView: action.stockStatus,
    statusPhrase: action.stockStatus.label,
    stockStatus: action.stockStatus,
    stockAction: action.stockAction,
    actionReason: action.actionReason,
    recommendReasons,
    recommendReasonSummary: formatRecommendReasonSummary(recommendReasons),
    marketFitSource: ctx ? "adapter" : "manual",
    sectorLabel,
  }
}

/**
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null} [marketContext]
 * @returns {StockPickView[]}
 */
export function getStockPickUniverse(marketContext = null) {
  const enriched = universe.stocks.map((row) => enrichStock(row, marketContext))
  const sorted = [...enriched].sort((a, b) => b.scores.totalScore - a.scores.totalScore)
  return sorted.map((row, index) => ({ ...row, rank: index + 1 }))
}

/** @param {StockPickView[]} stocks */
export function assignRanks(stocks) {
  const sorted = sortStockPicks(stocks, "totalScore", "desc")
  return sorted.map((row, index) => ({ ...row, rank: index + 1 }))
}

/** @param {StockPickView[]} stocks @param {StockPickCountryId} countryId */
export function filterByCountry(stocks, countryId) {
  if (!countryId) return stocks
  return stocks.filter((s) => s.country === countryId)
}

/** @param {StockPickCountryId} countryId @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null} [marketContext] */
export function getStockPicksForCountry(countryId, marketContext = null) {
  return assignRanks(filterByCountry(getStockPickUniverse(marketContext), countryId))
}

/**
 * @param {string} ticker
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null} [marketContext]
 */
export function getStockPickByTicker(ticker, marketContext = null) {
  const key = String(ticker ?? "").toUpperCase()
  const all = getStockPickUniverse(marketContext)
  const stock = all.find((s) => s.ticker.toUpperCase() === key) ?? null
  if (!stock) return null
  return assignRanks(filterByCountry(all, stock.country)).find(
    (s) => s.ticker.toUpperCase() === key,
  ) ?? stock
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
    if (key === "rank") return mul * (a.rank - b.rank)
    if (key === "totalScore") return mul * (a.scores.totalScore - b.scores.totalScore)
    if (key in a.scores) {
      return mul * (a.scores[key] - b.scores[key])
    }
    const av = a[key] ?? 0
    const bv = b[key] ?? 0
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

export { DEFAULT_MARKET_CONTEXT } from "./ydsMarketAdapter.js"

export const TOP3_MEDALS = ["🥇", "🥈", "🥉"]
