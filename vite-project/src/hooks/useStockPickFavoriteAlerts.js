import { useEffect, useState } from "react"
import { resolveStockPickCardAction } from "../content/ydsStockPickCardAction.js"

const STORAGE_KEY = "yds-stock-pick-fav-watch-v2"
const LEGACY_KEY = "yds-stock-pick-fav-watch-v1"

/**
 * @returns {Record<string, {
 *   total: number
 *   timing: number
 *   marketFit: number
 *   statusId: string
 *   cardActionId: string
 * }>}
 */
function readWatchState() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_KEY)
      if (legacy) raw = legacy
    }
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

/** @param {Record<string, unknown>} map */
function writeWatchState(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

/**
 * @typedef {{
 *   ticker: string
 *   name: string
 *   message: string
 *   type: 'scoreUp' | 'timingUp' | 'marketFitUp' | 'entryReady' | 'statusChange' | 'noChaseLift' | 'statusUpgrade'
 * }} FavoriteAlert
 */

/** @param {import("../content/ydsStockPickModel.js").StockPickView} stock */
function snapshotFromStock(stock) {
  const total = stock.v4Score?.total ?? stock.scoreBreakdown?.total ?? 0
  const timing = stock.v4Score?.timing ?? 0
  const marketFit = stock.pickMeta?.marketFitScore ?? stock.scoreBreakdown?.marketEnv ?? 0
  const statusId = stock.v4Score?.recommendStatusId ?? ""
  const cardActionId = resolveStockPickCardAction(stock).id
  return {
    total: Math.round(total),
    timing: Math.round(timing),
    marketFit: Math.round(marketFit),
    statusId,
    cardActionId,
  }
}

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
    /** @type {typeof prev} */
    const next = { ...prev }
    /** @type {FavoriteAlert[]} */
    const found = []

    for (const stock of liveStocks) {
      if (!favorites.has(stock.ticker)) continue

      const snap = snapshotFromStock(stock)
      const before = prev[stock.ticker]

      if (before) {
        const totalDelta = snap.total - before.total
        if (totalDelta >= 10) {
          found.push({
            ticker: stock.ticker,
            name: stock.name,
            message: `총점 ${before.total} → ${snap.total} (▲+${totalDelta})`,
            type: "scoreUp",
          })
        }

        const timingDelta = snap.timing - before.timing
        if (timingDelta >= 5) {
          found.push({
            ticker: stock.ticker,
            name: stock.name,
            message: `타이밍 ${before.timing} → ${snap.timing} (▲+${timingDelta})`,
            type: "timingUp",
          })
        }

        const mfDelta = snap.marketFit - before.marketFit
        if (mfDelta >= 2) {
          found.push({
            ticker: stock.ticker,
            name: stock.name,
            message: `시장적합 ${before.marketFit} → ${snap.marketFit} (▲+${mfDelta})`,
            type: "marketFitUp",
          })
        }

        if (before.cardActionId !== "entry" && snap.cardActionId === "entry") {
          found.push({
            ticker: stock.ticker,
            name: stock.name,
            message: "1차 진입 가능",
            type: "entryReady",
          })
        }

        if (before.statusId && snap.statusId && before.statusId !== snap.statusId) {
          found.push({
            ticker: stock.ticker,
            name: stock.name,
            message: `상태 변경 · ${before.statusId} → ${snap.statusId}`,
            type: "statusChange",
          })
        }

        if (before.statusId === "noChase" && snap.statusId !== "noChase") {
          found.push({
            ticker: stock.ticker,
            name: stock.name,
            message: "추격금지 해제",
            type: "noChaseLift",
          })
        }
        if (before.statusId === "watch" && snap.statusId === "scaleIn") {
          found.push({
            ticker: stock.ticker,
            name: stock.name,
            message: "관망 → 분할진입",
            type: "statusUpgrade",
          })
        }
      }

      next[stock.ticker] = snap
    }

    writeWatchState(next)
    setAlerts(found.slice(0, 12))
  }, [liveStocks, favorites])

  return alerts
}
