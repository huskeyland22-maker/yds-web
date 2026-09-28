/**
 * Display filter only. Score is already computed by equityDailyBottomBuy.
 * 4/4 first, then 3/4. Same score keeps the universe order.
 * @param {Array<{ ok?: boolean, symbol?: string, score?: number | null } | null>} views
 * @param {string[]} universeSymbols
 */
export function selectEquityBuyCandidates(views, universeSymbols) {
  const order = new Map(universeSymbols.map((symbol, index) => [symbol, index]))
  return views
    .filter((view) => view?.ok && (view.score === 3 || view.score === 4))
    .slice()
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return (order.get(a.symbol) ?? 0) - (order.get(b.symbol) ?? 0)
    })
}
