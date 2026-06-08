import { useCallback, useEffect, useState } from "react"

const STORAGE_KEY = "yds-portfolio-holdings-v1"
const DEFAULT = { stockPct: 80, cashPct: 20 }

/** @returns {{ stockPct: number; cashPct: number }} */
function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT
    const parsed = JSON.parse(raw)
    const stockPct = Number(parsed.stockPct)
    if (!Number.isFinite(stockPct)) return DEFAULT
    const clamped = Math.max(0, Math.min(100, Math.round(stockPct)))
    return { stockPct: clamped, cashPct: 100 - clamped }
  } catch {
    return DEFAULT
  }
}

export function usePortfolioHoldings() {
  const [holdings, setHoldings] = useState(readStored)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings))
    } catch {
      /* ignore */
    }
  }, [holdings])

  const setStockPct = useCallback((stockPct) => {
    const next = Math.max(0, Math.min(100, Math.round(Number(stockPct) || 0)))
    setHoldings({ stockPct: next, cashPct: 100 - next })
  }, [])

  return { holdings, setStockPct, setHoldings }
}
