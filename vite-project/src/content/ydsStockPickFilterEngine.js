/**
 * GO #75 — 전체 종목 복합 필터
 */

import { filterByCountry, filterBySector } from "./ydsStockPickModel.js"
import { resolveStockPickUxStatus } from "./ydsStockPickUxStatus.js"
import {
  isBuyPossibleStatus,
  isRecommendProhibitedStatus,
} from "./ydsStockPickRecommendColors.js"
import { resolveAiScore, resolveRecommendGradeSort } from "./ydsStockPickListView.js"

/** @typedef {import("./ydsStockPickModel.js").StockPickView} StockPickView */

/**
 * @typedef {{
 *   country?: 'all' | 'US' | 'KR'
 *   sector?: string
 *   recommendStatus?: 'all' | import("./ydsStockPickUxStatus.js").StockPickUxStatusId
 *   aiScoreMin?: number | null
 *   grade?: 'all' | 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'
 *   confidenceMin?: number | null
 *   favoritesOnly?: boolean
 *   buyPossibleOnly?: boolean
 *   noChaseOnly?: boolean
 * }} StockPickFilterState
 */

export const DEFAULT_STOCK_PICK_FILTERS = /** @type {StockPickFilterState} */ ({
  country: "all",
  sector: "all",
  recommendStatus: "all",
  aiScoreMin: null,
  grade: "all",
  confidenceMin: null,
  favoritesOnly: false,
  buyPossibleOnly: false,
  noChaseOnly: false,
})

/**
 * @param {StockPickView[]} stocks
 * @param {StockPickFilterState} filters
 * @param {{ isFavorite?: (ticker: string) => boolean }} [ctx]
 */
export function applyStockPickFilters(stocks, filters, ctx = {}) {
  let list = stocks

  if (filters.country && filters.country !== "all") {
    list = filterByCountry(list, filters.country)
  }

  if (filters.sector && filters.sector !== "all") {
    list = filterBySector(list, filters.sector)
  }

  if (filters.recommendStatus && filters.recommendStatus !== "all") {
    list = list.filter(
      (s) => resolveStockPickUxStatus(s).id === filters.recommendStatus,
    )
  }

  if (filters.aiScoreMin != null && Number.isFinite(filters.aiScoreMin)) {
    const min = filters.aiScoreMin
    list = list.filter((s) => resolveAiScore(s) >= min)
  }

  if (filters.grade && filters.grade !== "all") {
    list = list.filter((s) => {
      const g = s.v4Score?.qualityDisplayGrade ?? s.v4Score?.qualityGrade
      return g === filters.grade
    })
  }

  if (filters.confidenceMin != null && Number.isFinite(filters.confidenceMin)) {
    const min = filters.confidenceMin
    list = list.filter(
      (s) => (s.trustReport?.aiConfidence?.score ?? 0) >= min,
    )
  }

  if (filters.favoritesOnly && ctx.isFavorite) {
    list = list.filter((s) => ctx.isFavorite(s.ticker))
  }

  if (filters.buyPossibleOnly) {
    list = list.filter((s) => isBuyPossibleStatus(resolveStockPickUxStatus(s).id))
  }

  if (filters.noChaseOnly) {
    list = list.filter((s) => isRecommendProhibitedStatus(resolveStockPickUxStatus(s).id))
  }

  return list
}

/** @param {StockPickFilterState} a @param {StockPickFilterState} b */
export function countActiveStockPickFilters(a, b = DEFAULT_STOCK_PICK_FILTERS) {
  let n = 0
  if (a.country !== b.country && a.country !== "all") n += 1
  if (a.sector !== b.sector && a.sector !== "all") n += 1
  if (a.recommendStatus !== b.recommendStatus && a.recommendStatus !== "all") n += 1
  if (a.aiScoreMin != null) n += 1
  if (a.grade !== b.grade && a.grade !== "all") n += 1
  if (a.confidenceMin != null) n += 1
  if (a.favoritesOnly) n += 1
  if (a.buyPossibleOnly) n += 1
  if (a.noChaseOnly) n += 1
  return n
}
