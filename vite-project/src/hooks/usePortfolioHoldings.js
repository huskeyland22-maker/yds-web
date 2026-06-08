import { useMemo } from "react"
import { buildV4Holdings, deriveCashFromTrades } from "../content/ydsPortfolioV4Engine.js"
import { usePortfolioTrades } from "./usePortfolioTrades.js"

export function usePortfolioHoldings() {
  const { trades, addTrade, removeTrade } = usePortfolioTrades()

  const cashAmount = useMemo(() => deriveCashFromTrades(trades), [trades])

  const portfolio = useMemo(
    () => buildV4Holdings(trades, cashAmount),
    [trades, cashAmount],
  )

  return {
    trades,
    addTrade,
    removeTrade,
    portfolio,
    cashAmount,
  }
}
