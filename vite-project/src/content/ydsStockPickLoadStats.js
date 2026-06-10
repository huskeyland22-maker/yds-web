/**
 * 종목추천 실데이터 로드 진단
 */

import universe from "../data/stockPickUniverse.json" with { type: "json" }

/** @typedef {'US' | 'KR'} StockPickCountryId */

/**
 * @param {import("./ydsStockPickModel.js").StockPickView[]} allStocks
 */
export function computeStockPickLoadStats(allStocks) {
  const totals = { US: 0, KR: 0 }
  const live = { US: 0, KR: 0 }

  for (const row of universe.stocks) {
    totals[row.country] += 1
  }

  for (const stock of allStocks) {
    if (stock.dataSource === "live") {
      live[stock.country] += 1
    }
  }

  const totalUniverse = totals.US + totals.KR
  const totalLive = live.US + live.KR
  const totalMissing = totalUniverse - totalLive
  const fallbackCount = allStocks.filter((s) => s.dataSource === "fallback").length

  /** @type {{ ticker: string; name: string; country: StockPickCountryId }[]} */
  const missingTickers = []
  const liveSet = new Set(
    allStocks.filter((s) => s.dataSource === "live").map((s) => s.ticker),
  )
  for (const row of universe.stocks) {
    if (!liveSet.has(row.ticker)) {
      missingTickers.push({
        ticker: row.ticker,
        name: row.name,
        country: row.country,
      })
    }
  }

  return {
    totals,
    live,
    totalUniverse,
    totalLive,
    totalMissing,
    fallbackCount,
    missingTickers,
    complete: totalMissing === 0,
  }
}

/**
 * @param {ReturnType<typeof computeStockPickLoadStats>} stats
 */
export function formatStockPickLoadBanner(stats) {
  const us = `${stats.live.US} / ${stats.totals.US}`
  const kr = `${stats.live.KR} / ${stats.totals.KR}`
  if (stats.complete) {
    return { headline: "실데이터 로드", us, kr, note: null }
  }
  return {
    headline: "실데이터 로드",
    us,
    kr,
    note: `데이터 누락 ${stats.totalMissing}건`,
  }
}
