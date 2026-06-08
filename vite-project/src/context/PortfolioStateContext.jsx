import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { resolvePortfolioPrices } from "../content/ydsPortfolioPriceProvider.js"
import {
  buildV5Holdings,
  deriveCashFromTrades,
  replayPortfolioFromTrades,
  tradeAmountKrw,
} from "../content/ydsPortfolioV5Engine.js"
import {
  createTradeId,
  loadPortfolioTrades,
  savePortfolioTrades,
  todayDateKey,
} from "../content/ydsPortfolioTradesStorage.js"

/** @typedef {import("../content/ydsPortfolioTradesStorage.js").PortfolioTrade} PortfolioTrade */
/** @typedef {import("../content/ydsPortfolioTradesStorage.js").TradeAction} TradeAction */
/** @typedef {import("../content/ydsPortfolioV5Engine.js").HoldingsSortKey} HoldingsSortKey */

/** @type {import("react").Context<null | ReturnType<typeof usePortfolioStateValue>>} */
const PortfolioStateContext = createContext(null)

function usePortfolioStateValue() {
  const [trades, setTrades] = useState(() => loadPortfolioTrades())
  const [sortBy, setSortBy] = useState(/** @type {HoldingsSortKey} */ ("returnPct"))

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

  /** @param {string} id */
  const removeTrade = useCallback((id) => {
    setTrades((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const cashAmount = useMemo(() => deriveCashFromTrades(trades), [trades])

  const priceMap = useMemo(() => {
    const { lots } = replayPortfolioFromTrades(trades)
    return resolvePortfolioPrices(lots)
  }, [trades])

  const portfolio = useMemo(
    () => buildV5Holdings(trades, cashAmount, priceMap, sortBy),
    [trades, cashAmount, priceMap, sortBy],
  )

  return {
    trades,
    addTrade,
    removeTrade,
    portfolio,
    cashAmount,
    priceMap,
    sortBy,
    setSortBy,
  }
}

/** @param {{ children: import("react").ReactNode }} props */
export function PortfolioStateProvider({ children }) {
  const value = usePortfolioStateValue()
  return <PortfolioStateContext.Provider value={value}>{children}</PortfolioStateContext.Provider>
}

export function usePortfolioHoldings() {
  const ctx = useContext(PortfolioStateContext)
  if (!ctx) {
    throw new Error("usePortfolioHoldings must be used within PortfolioStateProvider")
  }
  return ctx
}
