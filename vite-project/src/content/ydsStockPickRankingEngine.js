/**
 * GO #83 — AI 추천 랭킹 정렬 엔진
 */

import { getRecommendEngineSortScore } from "./ydsStockRecommendEngine.js"
import { computeRankChange } from "./ydsStockPickRankChanges.js"
import { getRecommendScoreDelta } from "./ydsStockPickScoreHistory.js"
import { findValidationPickByTicker } from "./ydsPickValidationLink.js"
import { resolveRecommendStatusView } from "./ydsStockPickRecommendColors.js"
import { buildStockPickTradeScenarioReport } from "./ydsStockPickTradeScenario.js"
import { calcRecommendReturnPct } from "../trading-zone/tradingZoneRecommendationTrack.js"

/** @typedef {import("./ydsStockPickModel.js").StockPickView} StockPickView */

/** @typedef {'aiScore' | 'upside' | 'priority' | 'confidence' | 'scoreDelta' | 'expectedReturn' | 'maintainDays' | 'rank'} RankingSortKey */

export const RANKING_SORT_OPTIONS = [
  { id: "aiScore", label: "AI점수" },
  { id: "upside", label: "상승 기대치" },
  { id: "priority", label: "추천 우선순위" },
  { id: "confidence", label: "신뢰도" },
  { id: "scoreDelta", label: "최근 점수 상승" },
  { id: "expectedReturn", label: "예상 수익률" },
  { id: "maintainDays", label: "추천 유지기간" },
  { id: "rank", label: "기본 순위" },
]

/**
 * @param {StockPickView} stock
 */
function computeUpsideScore(stock) {
  const scenario = buildStockPickTradeScenarioReport(stock, null, null)
  const bull = scenario.scenarios?.find((s) => s.id === "bull")
  const momentum = stock.recommendEngine?.scores?.momentum ?? 50
  return (bull?.probability ?? 30) * 0.6 + momentum * 0.4
}

/**
 * @param {StockPickView} stock
 */
function computeExpectedReturn(stock) {
  const price = Number(stock.snapshot?.price ?? stock.snapshot?.close)
  const momentum = stock.recommendEngine?.scores?.momentum ?? 50
  if (!Number.isFinite(price) || price <= 0) return momentum * 0.25
  const scenario = buildStockPickTradeScenarioReport(stock, null, null)
  const bull = scenario.scenarios?.find((s) => s.id === "bull")
  const prob = (bull?.probability ?? 40) / 100
  const targetPct = 12 + momentum / 5
  return prob * targetPct
}

/**
 * @param {StockPickView} stock
 */
function computeMaintainDays(stock) {
  const country = stock.country === "KR" ? "KR" : "US"
  const pick = findValidationPickByTicker(stock.ticker, country)
  if (!pick?.recommendedAt) return 0
  const today = new Date().toISOString().slice(0, 10)
  return Math.max(
    0,
    Math.round((Date.parse(today) - Date.parse(String(pick.recommendedAt).slice(0, 10))) / 86400000),
  )
}

/**
 * @param {StockPickView} stock
 * @param {RankingSortKey} key
 */
export function getRankingSortValue(stock, key) {
  switch (key) {
    case "aiScore":
      return getRecommendEngineSortScore(stock)
    case "upside":
      return computeUpsideScore(stock)
    case "priority":
      return stock.rank > 0 ? 1000 - stock.rank : 0
    case "confidence":
      return stock.trustReport?.aiConfidence?.score ?? 0
    case "scoreDelta":
      return getRecommendScoreDelta(stock.ticker)?.delta ?? 0
    case "expectedReturn":
      return computeExpectedReturn(stock)
    case "maintainDays":
      return computeMaintainDays(stock)
    case "rank":
    default:
      return stock.rank > 0 ? stock.rank : 9999
  }
}

/**
 * @param {StockPickView[]} stocks
 * @param {RankingSortKey} key
 * @param {'asc' | 'desc'} dir
 * @param {number} [limit]
 */
export function sortRankingStocks(stocks, key, dir = "desc", limit = 100) {
  const mul = dir === "asc" ? 1 : -1
  const live = stocks.filter((s) => s.dataSource === "live")
  const sorted = [...live].sort((a, b) => {
    const av = getRankingSortValue(a, key)
    const bv = getRankingSortValue(b, key)
    if (key === "rank" || key === "priority") {
      return mul * (Number(av) - Number(bv))
    }
    return mul * (Number(bv) - Number(av))
  })
  return sorted.slice(0, limit)
}

/**
 * @param {StockPickView} stock
 * @param {number} index
 */
export function buildRankingRowView(stock, index) {
  const rankChange = computeRankChange(stock)
  const scoreDelta = getRecommendScoreDelta(stock.ticker)
  const status = resolveRecommendStatusView(stock)
  const aiScore = Math.round(getRecommendEngineSortScore(stock))

  return {
    rank: index + 1,
    ticker: stock.ticker,
    name: stock.name,
    aiScore,
    rankChange,
    scoreDelta: scoreDelta
      ? {
          delta: scoreDelta.delta,
          display:
            scoreDelta.delta != null && scoreDelta.delta !== 0
              ? `${scoreDelta.delta > 0 ? "▲" : "▼"}${Math.abs(scoreDelta.delta)}`
              : "→0",
          direction: scoreDelta.direction,
        }
      : null,
    statusLabel: status.label,
    statusId: status.id,
    confidence: stock.trustReport?.aiConfidence?.score ?? null,
    expectedReturn: Math.round(computeExpectedReturn(stock) * 10) / 10,
    maintainDays: computeMaintainDays(stock),
  }
}

/**
 * @param {StockPickView[]} stocks
 * @param {RankingSortKey} sortKey
 * @param {'asc' | 'desc'} sortDir
 */
export function buildRankingPageReport(stocks, sortKey = "aiScore", sortDir = "desc") {
  const ranked = sortRankingStocks(stocks, sortKey, sortDir, 100)
  return {
    visible: ranked.length > 0,
    title: "AI 추천 랭킹",
    sortKey,
    sortDir,
    sortOptions: RANKING_SORT_OPTIONS,
    rows: ranked.map((s, i) => buildRankingRowView(s, i)),
  }
}
