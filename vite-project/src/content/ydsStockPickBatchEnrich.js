/**
 * V5/V6 — 배치 메타 enrichment (섹터순위 · 점수변화 · 인사이트)
 */

import { buildSectorRankMap } from "./ydsStockPickSectorRanks.js"
import {
  getScoreDeltas,
  readScoreHistory,
  recordScoreHistory,
} from "./ydsStockPickScoreHistory.js"
import { computeRankChange } from "./ydsStockPickRankChanges.js"
import {
  buildNoChaseReasons,
  buildTimingPenaltyReasons,
  resolvePricePosition,
  marketEnvToGrade,
  LONG_HOLD_QUALITY_MIN,
} from "./ydsStockPickV5Insights.js"
import { computeDataReliability } from "./ydsStockPickReliability.js"
import { resolveFinalAction } from "./ydsStockPickFinalAction.js"

/**
 * @typedef {{
 *   sectorRank: import("./ydsStockPickSectorRanks.js").SectorRankEntry | null
 *   scoreDeltas: ReturnType<typeof getScoreDeltas> | null
 *   rankChange: import("./ydsStockPickRankChanges.js").RankChangeView
 *   noChaseReasons: string[]
 *   timingPenaltyReasons: string[]
 *   pricePosition: import("./ydsStockPickV5Insights.js").PricePositionView
 *   reliability: import("./ydsStockPickReliability.js").DataReliabilityView
 *   finalAction: import("./ydsStockPickFinalAction.js").FinalActionView
 *   marketFitGrade: string
 *   marketFitScore: number
 *   longHoldCandidate: boolean
 * }} StockPickMeta
 */

/**
 * @param {import("./ydsStockPickModel.js").StockPickView[]} liveStocks
 * @param {import("./ydsStockPickModel.js").StockPickView[]} universeStocks
 * @returns {import("./ydsStockPickModel.js").StockPickView[]}
 */
export function applyStockPickBatchMeta(liveStocks, universeStocks) {
  const sectorRankMap = buildSectorRankMap(universeStocks)
  const historyBefore = readScoreHistory()

  const enriched = liveStocks.map((stock) => {
    const marketFitScore = stock.scoreBreakdown?.marketEnv ?? 0
    const scoreDeltas = getScoreDeltas(stock.ticker, historyBefore)

    /** @type {StockPickMeta} */
    const pickMeta = {
      sectorRank: sectorRankMap.get(stock.ticker) ?? null,
      scoreDeltas,
      rankChange: computeRankChange(stock, historyBefore),
      noChaseReasons: buildNoChaseReasons(stock),
      timingPenaltyReasons: buildTimingPenaltyReasons(stock),
      pricePosition: resolvePricePosition(stock),
      reliability: computeDataReliability(stock),
      finalAction: resolveFinalAction(stock),
      marketFitGrade: marketEnvToGrade(marketFitScore, 15),
      marketFitScore,
      longHoldCandidate: (stock.v4Score?.quality ?? 0) >= LONG_HOLD_QUALITY_MIN,
    }

    return { ...stock, pickMeta, scoreDeltas }
  })

  recordScoreHistory(enriched, historyBefore)
  return enriched
}
