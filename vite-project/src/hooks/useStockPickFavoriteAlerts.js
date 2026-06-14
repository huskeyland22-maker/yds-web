import { useEffect, useState } from "react"

const STORAGE_KEY = "yds-stock-pick-fav-watch-v1"

/** @returns {Record<string, { total: number; statusId: string }>} */
function readWatchState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

/** @param {Record<string, { total: number; statusId: string }>} map */
function writeWatchState(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

/**
 * @typedef {{
 *   ticker: string
 *   name: string
 *   message: string
 *   type: 'scoreUp' | 'noChaseLift' | 'statusUpgrade'
 * }} FavoriteAlert
 */

/**
 * @param {import("../content/ydsStockPickModel.js").StockPickView[]} liveStocks
 * @param {Set<string>} favorites
 */
export function useStockPickFavoriteAlerts(liveStocks, favorites) {
  const [alerts, setAlerts] = useState(/** @type {FavoriteAlert[]} */ ([]))

  useEffect(() => {
    if (!liveStocks.length || !favorites.size) {
      setAlerts([])
      return
    }

    const prev = readWatchState()
    /** @type {Record<string, { total: number; statusId: string }>} */
    const next = { ...prev }
    /** @type {FavoriteAlert[]} */
    const found = []

    for (const stock of liveStocks) {
      if (!favorites.has(stock.ticker)) continue

      const total = stock.v4Score?.total ?? stock.scoreBreakdown?.total ?? 0
      const statusId = stock.v4Score?.recommendStatusId ?? ""
      const before = prev[stock.ticker]

      if (before) {
        const delta = total - before.total
        if (delta >= 10) {
          found.push({
            ticker: stock.ticker,
            name: stock.name,
            message: `점수 ${before.total} → ${total} (▲+${delta})`,
            type: "scoreUp",
          })
        }
        if (before.statusId === "noChase" && statusId !== "noChase") {
          found.push({
            ticker: stock.ticker,
            name: stock.name,
            message: "추격금지 해제",
            type: "noChaseLift",
          })
        }
        if (before.statusId === "watch" && statusId === "scaleIn") {
          found.push({
            ticker: stock.ticker,
            name: stock.name,
            message: "관망 → 분할진입",
            type: "statusUpgrade",
          })
        }
      }

      next[stock.ticker] = { total, statusId }
    }

    writeWatchState(next)
    setAlerts(found.slice(0, 8))
  }, [liveStocks, favorites])

  return alerts
}
