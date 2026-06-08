import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { normalizeCashBalance } from "../content/ydsPortfolioCashEngine.js"
import { loadCashBalance, saveCashBalance } from "../content/ydsPortfolioCashBalanceStorage.js"
import { setPortfolioUsdKrw, getPortfolioUsdKrw } from "../content/ydsPortfolioPriceProvider.js"
import {
  fetchPortfolioQuotes,
  PORTFOLIO_QUOTE_REFRESH_MS,
} from "../content/ydsPortfolioQuoteService.js"
import {
  buildV5Holdings,
  emptyPortfolioHoldings,
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
/** @typedef {import("../content/ydsPortfolioQuoteTypes.js").PortfolioQuote} PortfolioQuote */

/** @type {import("react").Context<null | ReturnType<typeof usePortfolioStateValue>>} */
const PortfolioStateContext = createContext(null)

function usePortfolioStateValue() {
  const [trades, setTrades] = useState(() => {
    try {
      const loaded = loadPortfolioTrades()
      return Array.isArray(loaded) ? loaded : []
    } catch {
      return []
    }
  })
  const [cashBalance, setCashBalanceState] = useState(() => {
    try {
      return loadCashBalance() ?? 0
    } catch {
      return 0
    }
  })
  const [sortBy, setSortBy] = useState(/** @type {HoldingsSortKey} */ ("returnPct"))
  /** @type {[Map<string, PortfolioQuote>, import("react").Dispatch<import("react").SetStateAction<Map<string, PortfolioQuote>>>]} */
  const [quoteMap, setQuoteMap] = useState(() => new Map())
  const [usdkrw, setUsdkrw] = useState(/** @type {number | null} */ (null))
  const [quotesLoading, setQuotesLoading] = useState(false)
  const [quotesFetchedAt, setQuotesFetchedAt] = useState(/** @type {string | null} */ (null))
  const [quotesError, setQuotesError] = useState(/** @type {string | null} */ (null))

  useEffect(() => {
    savePortfolioTrades(trades)
  }, [trades])

  useEffect(() => {
    saveCashBalance(cashBalance)
  }, [cashBalance])

  const lotsSignature = useMemo(() => {
    const { lots } = replayPortfolioFromTrades(trades)
    return lots
      .filter((l) => l.priceReady && l.ticker)
      .map((l) => `${l.id}:${l.ticker}:${l.country}`)
      .join("|")
  }, [trades])

  useEffect(() => {
    let cancelled = false
    const { lots } = replayPortfolioFromTrades(trades)

    async function refreshQuotes() {
      try {
        if (!lots.some((l) => l?.priceReady && l.ticker)) {
          setQuoteMap(new Map())
          return
        }

        setQuotesLoading(true)
        const result = await fetchPortfolioQuotes(lots)
        if (cancelled) return

        setQuoteMap(result?.quoteMap instanceof Map ? result.quoteMap : new Map())
        if (result?.usdkrw != null && result.usdkrw > 0) {
          setPortfolioUsdKrw(result.usdkrw)
          setUsdkrw(result.usdkrw)
        }
        setQuotesFetchedAt(result?.fetchedAt ?? null)
        setQuotesError(result?.error ?? null)
      } catch (e) {
        if (!cancelled) {
          console.error("[PortfolioState] quote refresh failed", e)
          setQuoteMap(new Map())
          setQuotesError(e instanceof Error ? e.message : "quote_refresh_failed")
        }
      } finally {
        if (!cancelled) setQuotesLoading(false)
      }
    }

    refreshQuotes()
    const timer = setInterval(refreshQuotes, PORTFOLIO_QUOTE_REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [lotsSignature, trades])

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

  /** @param {number} amount */
  const setCashBalance = useCallback((amount) => {
    setCashBalanceState(normalizeCashBalance(amount))
  }, [])

  const cashAmount = cashBalance
  const fxRate = usdkrw ?? getPortfolioUsdKrw()

  const portfolio = useMemo(() => {
    try {
      return buildV5Holdings(trades ?? [], cashAmount ?? 0, quoteMap, sortBy, fxRate)
    } catch (e) {
      console.error("[PortfolioState] buildV5Holdings failed", e)
      return emptyPortfolioHoldings()
    }
  }, [trades, cashAmount, quoteMap, sortBy, fxRate])

  return {
    trades,
    addTrade,
    removeTrade,
    cashAmount,
    setCashBalance,
    portfolio,
    quoteMap,
    usdkrw: fxRate,
    quotesLoading,
    quotesFetchedAt,
    quotesError,
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
