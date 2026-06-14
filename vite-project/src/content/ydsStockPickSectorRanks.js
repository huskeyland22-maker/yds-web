/**
 * V5/V6 — 섹터 내 순위 (전체 유니버스 기준)
 */

import { STOCK_PICK_SECTORS } from "./ydsStockPickModel.js"
import { getStockPickTotalScore } from "./ydsStockPickUxStatus.js"

/**
 * @typedef {{
 *   sectorId: string
 *   sectorLabel: string
 *   rank: number
 *   totalInSector: number
 *   display: string
 *   isLeader: boolean
 * }} SectorRankEntry
 */

/**
 * @param {import("./ydsStockPickModel.js").StockPickView[]} stocks
 * @returns {Map<string, SectorRankEntry>}
 */
export function buildSectorRankMap(stocks) {
  /** @type {Map<string, SectorRankEntry>} */
  const map = new Map()

  for (const sector of STOCK_PICK_SECTORS) {
    if (sector.id === "all") continue

    const filtered = stocks
      .filter((s) => s.sector === sector.id)
      .sort(
        (a, b) => (getStockPickTotalScore(b) ?? 0) - (getStockPickTotalScore(a) ?? 0),
      )

    filtered.forEach((stock, index) => {
      const rank = index + 1
      map.set(stock.ticker, {
        sectorId: sector.id,
        sectorLabel: sector.label,
        rank,
        totalInSector: filtered.length,
        display: `${sector.label} ${rank}위`,
        isLeader: rank <= 3,
      })
    })
  }

  return map
}
