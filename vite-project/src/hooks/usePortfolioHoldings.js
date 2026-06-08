import { useMemo } from "react"
import { computeHoldingsFromTrades } from "../content/ydsPortfolioTradeSync.js"
import { usePortfolioManualPositions } from "./usePortfolioManualPositions.js"
import { usePortfolioTrades } from "./usePortfolioTrades.js"

/** @typedef {import("../content/ydsPortfolioTradeSync.js").HoldingPosition} HoldingPosition */

export function usePortfolioHoldings() {
  const { manualPositions, addManualPosition, removeManualPosition } =
    usePortfolioManualPositions()
  const { trades, addTrade, removeTrade } = usePortfolioTrades()

  const positions = useMemo(
    () => computeHoldingsFromTrades(manualPositions, trades),
    [manualPositions, trades],
  )

  return {
    positions,
    manualPositions,
    trades,
    addManualPosition,
    removeManualPosition,
    addTrade,
    removeTrade,
  }
}
