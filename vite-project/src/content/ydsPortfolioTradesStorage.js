/**
 * YDS Portfolio V2 — 매매 기록 저장소
 */

import { loadActionLogs } from "./ydsActionLogStorage.js"

export const PORTFOLIO_TRADES_KEY = "yds-portfolio-trades-v1"
export const PORTFOLIO_TRADES_MIGRATED_KEY = "yds-portfolio-trades-migrated-v1"
const MANUAL_TO_TRADES_KEY = "yds-portfolio-v4-manual-migrated-v1"
const MANUAL_POSITIONS_KEY = "yds-portfolio-manual-v1"

/**
 * @typedef {'buy' | 'sell' | 'watch'} TradeAction
 */

/**
 * @typedef {{
 *   id: string
 *   date: string
 *   action: TradeAction
 *   name: string
 *   country?: 'us' | 'kr'
 *   amount: number | null
 *   quantity?: number | null
 *   memo: string
 *   createdAt: number
 *   updatedAt: number
 * }} PortfolioTrade
 */

/** @returns {PortfolioTrade[]} */
function migrateManualPositionsToTrades(trades) {
  try {
    if (localStorage.getItem(MANUAL_TO_TRADES_KEY)) return trades
    const raw = localStorage.getItem(MANUAL_POSITIONS_KEY)
    if (!raw) {
      localStorage.setItem(MANUAL_TO_TRADES_KEY, "1")
      return trades
    }
    const manual = JSON.parse(raw)
    if (!Array.isArray(manual) || !manual.length) {
      localStorage.setItem(MANUAL_TO_TRADES_KEY, "1")
      return trades
    }
    const now = Date.now()
    const buyTrades = manual
      .filter((p) => p && p.name)
      .map((p) => {
        const qty = Math.max(0, Number(p.quantity) || 0)
        const price = Math.max(0, Number(p.avgPrice) || 0)
        return {
          id: createTradeId(),
          date: p.buyDate || todayDateKey(),
          action: "buy",
          name: String(p.name).trim(),
          country: p.country === "kr" ? "kr" : "us",
          amount: Math.round(price * qty) || null,
          memo: "V4 이전 보유 이전",
          createdAt: p.createdAt ?? now,
          updatedAt: now,
        }
      })
      .filter((t) => t.amount && t.amount > 0)
    localStorage.setItem(MANUAL_TO_TRADES_KEY, "1")
    localStorage.removeItem(MANUAL_POSITIONS_KEY)
    return [...buyTrades, ...trades]
  } catch {
    return trades
  }
}

/** @returns {PortfolioTrade[]} */
export function loadPortfolioTrades() {
  try {
    const raw = localStorage.getItem(PORTFOLIO_TRADES_KEY)
    if (!raw) return migrateManualPositionsToTrades(migrateTradesFromActionLog())
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return migrateManualPositionsToTrades(migrateTradesFromActionLog())
    }
    return migrateManualPositionsToTrades(parsed.filter((t) => t && typeof t.id === "string"))
  } catch {
    return migrateManualPositionsToTrades(migrateTradesFromActionLog())
  }
}

/** @returns {PortfolioTrade[]} */
function migrateTradesFromActionLog() {
  try {
    if (localStorage.getItem(PORTFOLIO_TRADES_MIGRATED_KEY)) return []
  } catch {
    return []
  }

  const logs = loadActionLogs()
  if (!logs.length) {
    try {
      localStorage.setItem(PORTFOLIO_TRADES_MIGRATED_KEY, "1")
    } catch {
      /* ignore */
    }
    return []
  }

  const now = Date.now()
  const trades = logs.map((entry) => ({
    id: entry.id,
    date: entry.date,
    action: entry.quickAction ?? "watch",
    name: entry.ticker?.trim() || "—",
    amount: entry.endAsset != null && entry.startAsset != null
      ? Math.abs(entry.endAsset - entry.startAsset)
      : null,
    country: undefined,
    quantity: null,
    memo: entry.memo ?? "",
    createdAt: entry.createdAt ?? now,
    updatedAt: entry.updatedAt ?? now,
  }))

  savePortfolioTrades(trades)
  try {
    localStorage.setItem(PORTFOLIO_TRADES_MIGRATED_KEY, "1")
  } catch {
    /* ignore */
  }
  return trades
}

/** @param {PortfolioTrade[]} trades */
export function savePortfolioTrades(trades) {
  try {
    localStorage.setItem(PORTFOLIO_TRADES_KEY, JSON.stringify(trades))
  } catch {
    /* ignore */
  }
}

export function createTradeId() {
  return `trade-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** @returns {string} */
export function todayDateKey() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
