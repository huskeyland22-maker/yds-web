/**
 * 종목추천 파이프라인 단계별 디버그 카운트
 */

import universe from "../data/stockPickUniverse.json" with { type: "json" }

/**
 * @param {Map<string, import("./ydsStockPickLiveFetcher.js").LivePickSnapshotEntry>} snapshotMap
 * @param {import("./ydsStockPickModel.js").StockPickView[]} allStocks
 * @param {import("./ydsStockPickModel.js").StockPickView[]} filteredStocks
 * @param {{ ticker: string; error: string }[]} [errors]
 */
export function computeStockPickPipelineDebug(
  snapshotMap,
  allStocks,
  filteredStocks,
  errors = [],
) {
  const rawUs = universe.stocks.filter((s) => s.country === "US").length
  const rawKr = universe.stocks.filter((s) => s.country === "KR").length

  let usPriceSuccess = 0
  let krPriceSuccess = 0
  for (const row of universe.stocks) {
    if (!snapshotMap.has(row.ticker)) continue
    if (row.country === "US") usPriceSuccess += 1
    else if (row.country === "KR") krPriceSuccess += 1
  }

  const scoredStocks = allStocks
  const liveAfterScore = allStocks.filter((s) => s.dataSource === "live").length

  return {
    rawUs,
    rawKr,
    usPriceSuccess,
    krPriceSuccess,
    priceSuccessTotal: usPriceSuccess + krPriceSuccess,
    scored: scoredStocks.length,
    liveAfterScore,
    filtered: filteredStocks.length,
    fallbackAfterScore: scoredStocks.length - liveAfterScore,
    fetchErrors: errors.length,
    krBatchMode: true,
    loading: false,
  }
}

/**
 * @param {ReturnType<typeof computeStockPickPipelineDebug>} debug
 */
export function logStockPickPipelineDebug(debug) {
  console.log("US Raw:", debug.rawUs)
  console.log("KR Raw:", debug.rawKr)
  console.log("US Price Success:", debug.usPriceSuccess)
  console.log("KR Price Success:", debug.krPriceSuccess)
  console.log("After Score:", debug.scored)
  console.log("After Filter:", debug.filtered)
  if (debug.filtered === 0) {
    console.error("추천 종목 0개 원인", {
      rawUs: debug.rawUs,
      rawKr: debug.rawKr,
      usPriceSuccess: debug.usPriceSuccess,
      krPriceSuccess: debug.krPriceSuccess,
      scored: debug.scored,
      liveAfterScore: debug.liveAfterScore,
      fallbackAfterScore: debug.fallbackAfterScore,
      fetchErrors: debug.fetchErrors,
    })
  }
}
