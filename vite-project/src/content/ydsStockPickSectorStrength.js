/**
 * Phase 3 — 섹터 강도 (TOP3 평균 종합점수)
 */

import { STOCK_PICK_SECTORS } from "./ydsStockPickModel.js"
import { getStockPickTotalScore } from "./ydsStockPickUxStatus.js"
import { sortStockPicks } from "./ydsStockPickModel.js"

/**
 * @typedef {{
 *   sectorId: string
 *   label: string
 *   strength: number | null
 *   count: number
 *   top3Avg: number | null
 * }} SectorStrengthEntry
 */

/**
 * @param {import("./ydsStockPickModel.js").StockPickView[]} stocks
 * @param {string} sectorId
 * @param {number} [topN]
 */
export function computeSectorStrength(stocks, sectorId, topN = 3) {
  const filtered = stocks.filter((s) => s.sector === sectorId)
  if (!filtered.length) return null

  const sorted = sortStockPicks(filtered, "totalScore", "desc")
  const top = sorted.slice(0, topN)
  const scores = top
    .map((s) => getStockPickTotalScore(s))
    .filter((n) => Number.isFinite(n))

  if (!scores.length) return null
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView[]} stocks
 * @returns {Record<string, SectorStrengthEntry>}
 */
export function buildSectorStrengthMap(stocks) {
  /** @type {Record<string, SectorStrengthEntry>} */
  const map = {}

  for (const sector of STOCK_PICK_SECTORS) {
    if (sector.id === "all") continue
    const filtered = stocks.filter((s) => s.sector === sector.id)
    const strength = computeSectorStrength(stocks, sector.id, 3)
    map[sector.id] = {
      sectorId: sector.id,
      label: sector.label,
      strength,
      count: filtered.length,
      top3Avg: strength,
    }
  }

  return map
}

/**
 * 섹터 내부 TOP N — 추천 여부와 무관하게 전체 유니버스 기준
 * @param {import("./ydsStockPickModel.js").StockPickView[]} allStocks
 * @param {string} sectorId
 * @param {number} [limit]
 */
export function getSectorTopStocks(allStocks, sectorId, limit = 5) {
  if (!sectorId || sectorId === "all") return []
  const filtered = allStocks.filter((s) => s.sector === sectorId)
  return sortStockPicks(filtered, "totalScore", "desc").slice(0, limit)
}
