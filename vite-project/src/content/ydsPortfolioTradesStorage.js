/**
 * YDS Portfolio V2 — 매매 기록 저장소
 */

import { loadActionLogs } from "./ydsActionLogStorage.js"

export const PORTFOLIO_TRADES_KEY = "yds-portfolio-trades-v1"
export const PORTFOLIO_TRADES_MIGRATED_KEY = "yds-portfolio-trades-migrated-v1"

/**
 * @typedef {'buy' | 'sell' | 'watch'} TradeAction
 */

/**
 * @typedef {{
 *   id: string
 *   date: string
 *   action: TradeAction
 *   name: string
 *   amount: number | null
 *   memo: string
 *   createdAt: number
 *   updatedAt: number
 * }} PortfolioTrade
 */

/** @returns {PortfolioTrade[]} */
export function loadPortfolioTrades() {
  try {
    const raw = localStorage.getItem(PORTFOLIO_TRADES_KEY)
    if (!raw) return migrateTradesFromActionLog()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return migrateTradesFromActionLog()
    return parsed.filter((t) => t && typeof t.id === "string")
  } catch {
    return migrateTradesFromActionLog()
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
