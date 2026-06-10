/**
 * 종목추천 로컬 검색 — API 호출 없음
 */

/**
 * @param {import("./ydsStockPickModel.js").StockPickView[]} stocks
 * @param {string} query
 */
export function filterStockPicksByQuery(stocks, query) {
  const q = String(query ?? "").trim().toLowerCase()
  if (!q) return stocks

  return stocks.filter((stock) => {
    const name = String(stock.name ?? "").toLowerCase()
    const nameEn = String(stock.nameEn ?? "").toLowerCase()
    const ticker = String(stock.ticker ?? "").toLowerCase()
    const sector = String(stock.sectorLabel ?? stock.sector ?? "").toLowerCase()
    return (
      name.includes(q) ||
      nameEn.includes(q) ||
      ticker.includes(q) ||
      sector.includes(q)
    )
  })
}
