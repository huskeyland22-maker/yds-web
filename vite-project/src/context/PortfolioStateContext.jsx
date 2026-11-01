import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { normalizeCashBalance } from "../content/ydsPortfolioCashEngine.js"
import {
  loadCashBalanceForOwner,
  saveCashBalance,
  saveCashBalanceForOwner,
} from "../content/ydsPortfolioCashBalanceStorage.js"
import {
  PortfolioSyncConflictError,
  hasPortfolioSyncConflict,
  pushCloudPortfolio,
  reconcilePortfolioWithCloud,
} from "../content/ydsPortfolioCloudSync.js"
import { setPortfolioUsdKrw, getPortfolioUsdKrw } from "../content/ydsPortfolioPriceProvider.js"
import {
  fetchPortfolioQuotes,
  PORTFOLIO_QUOTE_REFRESH_MS,
} from "../content/ydsPortfolioQuoteService.js"
import { logPortfolioLoad } from "../content/ydsPortfolioLoadLog.js"
import { logPortfolioStorageAudit } from "../content/ydsPortfolioStorageDebug.js"
import {
  getActivePortfolioOwnerUid,
  setActivePortfolioOwnerUid,
  writePortfolioOwnerMeta,
} from "../content/ydsPortfolioStorageScope.js"
import {
  buildV5Holdings,
  emptyPortfolioHoldings,
  replayPortfolioFromTrades,
  tradeAmountKrw,
} from "../content/ydsPortfolioV5Engine.js"
import {
  createTradeId,
  getPortfolioLoadMeta,
  loadPortfolioTradesForOwner,
  savePortfolioTrades,
  savePortfolioTradesForOwner,
  todayDateKey,
} from "../content/ydsPortfolioTradesStorage.js"
import { useFirebaseAuthUser } from "../hooks/useFirebaseAuthUser.js"

/** @typedef {import("../content/ydsPortfolioTradesStorage.js").PortfolioTrade} PortfolioTrade */
/** @typedef {import("../content/ydsPortfolioTradesStorage.js").TradeAction} TradeAction */
/** @typedef {import("../content/ydsPortfolioV5Engine.js").HoldingsSortKey} HoldingsSortKey */
/** @typedef {import("../content/ydsPortfolioQuoteTypes.js").PortfolioQuote} PortfolioQuote */

/** @type {import("react").Context<null | ReturnType<typeof usePortfolioStateValue>>} */
const PortfolioStateContext = createContext(null)

function usePortfolioStateValue() {
  const { user, authReady } = useFirebaseAuthUser()
  // Start empty until auth scope is known — never hydrate from shared orphan key.
  const [trades, setTrades] = useState(/** @type {PortfolioTrade[]} */ ([]))
  const [cashBalance, setCashBalanceState] = useState(0)
  const [sortBy, setSortBy] = useState(/** @type {HoldingsSortKey} */ ("returnPct"))
  /** @type {[Map<string, PortfolioQuote>, import("react").Dispatch<import("react").SetStateAction<Map<string, PortfolioQuote>>>]} */
  const [quoteMap, setQuoteMap] = useState(() => new Map())
  const [usdkrw, setUsdkrw] = useState(/** @type {number | null} */ (null))
  const [quotesLoading, setQuotesLoading] = useState(false)
  const [quotesFetchedAt, setQuotesFetchedAt] = useState(/** @type {string | null} */ (null))
  const [quotesError, setQuotesError] = useState(/** @type {string | null} */ (null))
  const [syncMode, setSyncMode] = useState(/** @type {string} */ ("device-local"))
  const [syncReady, setSyncReady] = useState(false)
  const cloudPushTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null))
  const skipCloudPushRef = useRef(true)
  /** @type {import("react").MutableRefObject<string | null | undefined>} undefined = not hydrated yet */
  const ownerScopeRef = useRef(undefined)
  const tradesRef = useRef(trades)
  const cashRef = useRef(cashBalance)
  const scopeReadyRef = useRef(false)

  useEffect(() => {
    tradesRef.current = trades
  }, [trades])

  useEffect(() => {
    cashRef.current = cashBalance
  }, [cashBalance])

  useEffect(() => {
    logPortfolioLoad(trades, getPortfolioLoadMeta(), { user, syncMode })
    logPortfolioStorageAudit(trades, { user, syncMode })
  }, [])

  useEffect(() => {
    if (!scopeReadyRef.current) return
    if (getActivePortfolioOwnerUid() !== (ownerScopeRef.current ?? null)) return
    savePortfolioTrades(trades)
  }, [trades])

  useEffect(() => {
    if (!scopeReadyRef.current) return
    if (getActivePortfolioOwnerUid() !== (ownerScopeRef.current ?? null)) return
    saveCashBalance(cashBalance)
  }, [cashBalance])

  useEffect(() => {
    if (!authReady) return

    const nextUid = user?.uid ? String(user.uid) : null
    const prevUid = ownerScopeRef.current

    if (cloudPushTimerRef.current) {
      clearTimeout(cloudPushTimerRef.current)
      cloudPushTimerRef.current = null
    }
    skipCloudPushRef.current = true
    setSyncReady(false)

    // Persist in-memory data to the previous scope before switching (never touch other slots).
    if (prevUid !== undefined && prevUid !== nextUid) {
      savePortfolioTradesForOwner(prevUid, tradesRef.current)
      saveCashBalanceForOwner(prevUid, cashRef.current)
    }

    setActivePortfolioOwnerUid(nextUid)
    ownerScopeRef.current = nextUid
    writePortfolioOwnerMeta(nextUid)
    scopeReadyRef.current = true

    const localTrades = loadPortfolioTradesForOwner(nextUid)
    const localCash = loadCashBalanceForOwner(nextUid) ?? 0
    setTrades(localTrades)
    setCashBalanceState(localCash)

    if (!nextUid) {
      setSyncMode("device-local")
      setSyncReady(true)
      skipCloudPushRef.current = false
      return
    }

    // Persisted per-uid conflict — block debounce push for this session until cleared.
    if (hasPortfolioSyncConflict(nextUid)) {
      setSyncMode("account-conflict")
    }

    let cancelled = false

    async function pullAndReconcile() {
      try {
        const token = await user.getIdToken()
        const result = await reconcilePortfolioWithCloud(token, localTrades, localCash, {
          ownerUid: nextUid,
        })
        if (cancelled) return
        if (ownerScopeRef.current !== nextUid) return
        setTrades(result.trades)
        setCashBalanceState(result.cashBalance)
        if (result.mode === "conflict-hold" || hasPortfolioSyncConflict(nextUid)) {
          setSyncMode("account-conflict")
        } else {
          setSyncMode(result.source === "cloud" ? "account-cloud" : "account-local")
        }
      } catch (e) {
        if (!cancelled) {
          console.error("[portfolio-sync] reconcile failed", e)
          setSyncMode("account-error")
        }
      } finally {
        if (!cancelled && ownerScopeRef.current === nextUid) {
          setSyncReady(true)
          skipCloudPushRef.current = false
        }
      }
    }

    void pullAndReconcile()
    return () => {
      cancelled = true
    }
  }, [authReady, user?.uid])

  useEffect(() => {
    if (!user?.uid || !syncReady || skipCloudPushRef.current) return
    const ownerUid = String(user.uid)
    if (ownerScopeRef.current !== ownerUid) return
    // Conflict hold blocks automatic PUT even after local edits (flag is not cleared by edits).
    if (hasPortfolioSyncConflict(ownerUid)) {
      setSyncMode("account-conflict")
      return
    }

    if (cloudPushTimerRef.current) clearTimeout(cloudPushTimerRef.current)
    cloudPushTimerRef.current = setTimeout(async () => {
      try {
        if (ownerScopeRef.current !== ownerUid) return
        if (hasPortfolioSyncConflict(ownerUid)) {
          setSyncMode("account-conflict")
          return
        }
        const token = await user.getIdToken()
        const pushed = await pushCloudPortfolio(token, trades, cashBalance, { ownerUid })
        if (ownerScopeRef.current !== ownerUid) return
        if (pushed == null && hasPortfolioSyncConflict(ownerUid)) {
          setSyncMode("account-conflict")
          return
        }
        if (pushed != null) setSyncMode("account-synced")
      } catch (e) {
        if (e instanceof PortfolioSyncConflictError) {
          console.warn("[portfolio-sync] push conflict — local held, uploads blocked", e)
          if (ownerScopeRef.current === ownerUid) setSyncMode("account-conflict")
          return
        }
        console.warn("[portfolio-sync] push failed", e)
        if (ownerScopeRef.current === ownerUid) setSyncMode("account-push-error")
      }
    }, 900)

    return () => {
      if (cloudPushTimerRef.current) clearTimeout(cloudPushTimerRef.current)
    }
  }, [user?.uid, trades, cashBalance, syncReady])

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
    syncMode,
    syncReady,
    isLoggedIn: Boolean(user?.uid),
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
