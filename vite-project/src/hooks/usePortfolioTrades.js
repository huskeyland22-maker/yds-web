import { useCallback, useEffect, useState } from "react"
import { tradeAmountKrw } from "../content/ydsPortfolioV5Engine.js"
import {
  PORTFOLIO_DELETED_TRADE_ID,
  rememberDeletedPortfolioTradeIds,
} from "../content/ydsPortfolioCloudSync.js"
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
   *   ticker?: string
   *   country?: 'us' | 'kr'
   *   quantity?: number | null
   *   unitPrice?: number | null
   *   amount?: number | null
   *   memo?: string
   *   date?: string
   * }} input
   */
  const addTrade = useCallback((input) => {
    const now = Date.now()
    const country = input.country === "kr" ? "kr" : "us"
    const qty = input.quantity != null && Number.isFinite(input.quantity) ? Number(input.quantity) : null
    const unit =
      input.unitPrice != null && Number.isFinite(input.unitPrice) ? Number(input.unitPrice) : null

    const trade = {
      id: createTradeId(),
      date: input.date ?? todayDateKey(),
      action: input.action,
      name: String(input.name ?? "").trim(),
      ticker: String(input.ticker ?? "").trim() || undefined,
      country,
      quantity: qty,
      unitPrice: unit,
      amount: null,
      memo: String(input.memo ?? "").trim(),
      createdAt: now,
      updatedAt: now,
    }

    if (qty != null && qty > 0 && unit != null && unit > 0) {
      trade.amount = tradeAmountKrw(trade)
    } else if (input.amount != null && Number.isFinite(input.amount)) {
      trade.amount = Math.round(input.amount)
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
    if (typeof id === "string" && id && id !== PORTFOLIO_DELETED_TRADE_ID) {
      rememberDeletedPortfolioTradeIds([id])
    }
    setTrades((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { trades, addTrade, updateTrade, removeTrade }
}
