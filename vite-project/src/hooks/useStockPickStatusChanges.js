import { useEffect, useState } from "react"
import { STOCK_STATUS_VIEWS } from "../content/ydsStockActionEngine.js"

const STORAGE_KEY = "yds-stock-pick-status-prev"

/** @returns {Record<string, string>} */
function readPrev() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

/** @param {Record<string, string>} map */
function writePrev(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

/**
 * @param {import("../content/ydsStockPickModel.js").StockPickView[]} liveStocks
 */
export function useStockPickStatusChanges(liveStocks) {
  const [changes, setChanges] = useState(
    /** @type {Map<string, { from: string; to: string; fromLabel: string; toLabel: string }>} */ (
      new Map()
    ),
  )

  useEffect(() => {
    if (!liveStocks.length) return

    const prev = readPrev()
    /** @type {Record<string, string>} */
    const next = { ...prev }
    /** @type {Map<string, { from: string; to: string; fromLabel: string; toLabel: string }>} */
    const delta = new Map()

    for (const stock of liveStocks) {
      const to = stock.stockStatus?.id ?? stock.statusView?.id
      if (!to) continue
      const from = prev[stock.ticker]
      if (from && from !== to) {
        delta.set(stock.ticker, {
          from,
          to,
          fromLabel: STOCK_STATUS_VIEWS[from]?.label ?? from,
          toLabel: STOCK_STATUS_VIEWS[to]?.label ?? to,
        })
      }
      next[stock.ticker] = to
    }

    writePrev(next)
    setChanges(delta)
  }, [liveStocks])

  return changes
}
