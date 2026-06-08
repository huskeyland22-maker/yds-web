import { useCallback, useEffect, useState } from "react"
import {
  createPositionId,
  loadPortfolioPositions,
  PORTFOLIO_POSITIONS_KEY,
  savePortfolioPositions,
} from "../content/ydsPortfolioPositionsStorage.js"

const MANUAL_KEY = "yds-portfolio-manual-v1"
const MANUAL_MIGRATED_KEY = "yds-portfolio-manual-migrated-v1"

/** @typedef {import("../content/ydsPortfolioPositionsStorage.js").PortfolioPosition} PortfolioPosition */

/** @returns {PortfolioPosition[]} */
function loadManual() {
  try {
    const migrated = localStorage.getItem(MANUAL_MIGRATED_KEY)
    const raw = localStorage.getItem(MANUAL_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.filter((p) => p && typeof p.id === "string")
    }
    if (!migrated) {
      const legacy = loadPortfolioPositions()
      if (legacy.length) {
        saveManual(legacy)
      }
      localStorage.setItem(MANUAL_MIGRATED_KEY, "1")
      localStorage.removeItem(PORTFOLIO_POSITIONS_KEY)
      return legacy
    }
  } catch {
    /* ignore */
  }
  return []
}

/** @param {PortfolioPosition[]} positions */
function saveManual(positions) {
  try {
    localStorage.setItem(MANUAL_KEY, JSON.stringify(positions))
  } catch {
    /* ignore */
  }
}

export function usePortfolioManualPositions() {
  const [manualPositions, setManualPositions] = useState(loadManual)

  useEffect(() => {
    saveManual(manualPositions)
  }, [manualPositions])

  /**
   * @param {{
   *   name: string
   *   buyDate: string
   *   avgPrice: number
   *   quantity: number
   * }} input
   */
  const addManualPosition = useCallback((input) => {
    const now = Date.now()
    const name = String(input.name).trim()
    const position = {
      id: createPositionId(),
      name,
      ticker: /^\d{6}$/.test(name) ? name : "",
      country: /^\d{6}$/.test(name) ? "kr" : "us",
      buyDate: input.buyDate,
      avgPrice: Math.round(Number(input.avgPrice) || 0),
      quantity: Math.max(0, Math.round(Number(input.quantity) || 0)),
      currentPrice: null,
      createdAt: now,
      updatedAt: now,
    }
    setManualPositions((prev) => [position, ...prev])
    return position
  }, [])

  /** @param {string} id */
  const removeManualPosition = useCallback((id) => {
    setManualPositions((prev) => prev.filter((p) => p.id !== id))
  }, [])

  return { manualPositions, addManualPosition, removeManualPosition }
}
