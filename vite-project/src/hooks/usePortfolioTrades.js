import { useCallback, useEffect, useState } from "react"
import {
  createTradeId,
  loadPortfolioTrades,
  savePortfolioTrades,
  todayDateKey,
} from "../content/ydsPortfolioTradesStorage.js"

/** @typedef {import("../content/ydsPortfolioTradesStorage.js").PortfolioTrade} PortfolioTrade */
/** @typedef {import("../content/ydsPortfolioTradesStorage.js").TradeAction} TradeAction */

export function usePortfolioTrades() {
  const [trades, setTrades] = useState(() => loadPortfolioTrades())

  useEffect(() => {
    savePortfolioTrades(trades)
  }, [trades])

  /**
   * @param {{
   *   action: TradeAction
   *   name: string
   *   amount?: number | null
   *   quantity?: number | null
   *   memo?: string
   *   date?: string
   * }} input
   */
  const addTrade = useCallback((input) => {
    const now = Date.now()
    const trade = {
      id: createTradeId(),
      date: input.date ?? todayDateKey(),
      action: input.action,
      name: String(input.name ?? "").trim(),
      amount: input.amount != null && Number.isFinite(input.amount) ? Math.round(input.amount) : null,
      quantity:
        input.quantity != null && Number.isFinite(input.quantity)
          ? Math.max(0, Math.round(input.quantity))
          : null,
      memo: String(input.memo ?? "").trim(),
      createdAt: now,
      updatedAt: now,
    }
    setTrades((prev) => [trade, ...prev])
    return trade
  }, [])

  /**
   * @param {string} id
   * @param {Partial<PortfolioTrade>} updates
   */
  const updateTrade = useCallback((id, updates) => {
    setTrades((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t)),
    )
  }, [])

  /** @param {string} id */
  const removeTrade = useCallback((id) => {
    setTrades((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { trades, addTrade, updateTrade, removeTrade }
}
