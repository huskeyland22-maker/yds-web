import { useMemo } from "react"
import { replayPortfolioFromTrades } from "../content/ydsPortfolioV5Engine.js"
import { loadPortfolioTrades } from "../content/ydsPortfolioTradesStorage.js"

/** @returns {Set<string>} */
export function readHeldTickers() {
  try {
    const trades = loadPortfolioTrades()
    const { lots } = replayPortfolioFromTrades(Array.isArray(trades) ? trades : [])
    const set = new Set()
    for (const lot of lots) {
      if (!lot?.ticker || !lot.priceReady) continue
      set.add(String(lot.ticker).toUpperCase())
    }
    return set
  } catch {
    return new Set()
  }
}

export function useStockPickHeldTickers() {
  return useMemo(() => readHeldTickers(), [])
}
