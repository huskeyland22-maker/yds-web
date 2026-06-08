import { useCallback, useEffect, useState } from "react"

const STORAGE_KEY = "yds-portfolio-cash-v1"

/** @returns {number} */
function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return 0
    const n = Number(JSON.parse(raw))
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0
  } catch {
    return 0
  }
}

export function usePortfolioCash() {
  const [cashAmount, setCashAmountState] = useState(readStored)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cashAmount))
    } catch {
      /* ignore */
    }
  }, [cashAmount])

  const setCashAmount = useCallback((value) => {
    const n = Number(value)
    setCashAmountState(Number.isFinite(n) && n >= 0 ? Math.round(n) : 0)
  }, [])

  return { cashAmount, setCashAmount }
}
