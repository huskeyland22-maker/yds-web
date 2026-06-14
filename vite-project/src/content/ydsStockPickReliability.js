/**
 * V6 — 종목 신뢰도 (데이터 품질 기반)
 */

/**
 * @typedef {{
 *   stars: number
 *   display: string
 *   label: string
 * }} DataReliabilityView
 */

/** @param {number} n */
function starDisplay(n) {
  const filled = Math.max(1, Math.min(5, Math.round(n)))
  return "★".repeat(filled) + "☆".repeat(5 - filled)
}

/** @param {import("./ydsStockPickModel.js").StockPickView} stock */
export function computeDataReliability(stock) {
  let score = 5

  if (stock.dataSource !== "live") score -= 3
  if (!stock.quoteSource) score -= 1

  const diag = stock.statusDiag?.inputs ?? {}
  if (diag.close == null || diag.ma20 == null || diag.ma60 == null) score -= 1
  if (stock.timingScore?.checks?.every((c) => !c.pass)) score -= 1

  const stars = Math.max(1, Math.min(5, score))
  return {
    stars,
    display: starDisplay(stars),
    label: stars >= 4 ? "신뢰도 높음" : stars >= 3 ? "신뢰도 보통" : "데이터 부족",
  }
}
