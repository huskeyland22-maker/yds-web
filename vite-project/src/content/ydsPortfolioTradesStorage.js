/**
 * YDS Portfolio V2 — 매매 기록 저장소
 */

import { loadActionLogs } from "./ydsActionLogStorage.js"
import { PORTFOLIO_LEGACY_ALIAS_KEYS } from "./ydsPortfolioKeyRegistry.js"
import { PORTFOLIO_POSITIONS_KEY } from "./ydsPortfolioPositionsStorage.js"

export const PORTFOLIO_TRADES_KEY = "yds-portfolio-trades-v1"
export const PORTFOLIO_TRADES_MIGRATED_KEY = "yds-portfolio-trades-migrated-v1"
const MANUAL_TO_TRADES_KEY = "yds-portfolio-v4-manual-migrated-v1"
const MANUAL_POSITIONS_KEY = "yds-portfolio-manual-v1"

/** @type {{ sourceKey: string, migratedFrom: string | null } | null} */
let lastLoadMeta = null

/** @returns {{ sourceKey: string, migratedFrom: string | null } | null} */
export function getPortfolioLoadMeta() {
  return lastLoadMeta
}

/**
 * @typedef {'buy' | 'sell' | 'watch'} TradeAction
 */

/**
 * @typedef {{
 *   id: string
 *   date: string
 *   action: TradeAction
 *   name: string
 *   ticker?: string
 *   country?: 'us' | 'kr'
 *   amount: number | null
 *   quantity?: number | null
 *   unitPrice?: number | null
 *   memo: string
 *   createdAt: number
 *   updatedAt: number
 * }} PortfolioTrade
 */

/** @param {Record<string, unknown>} p */
function positionLikeToTrade(p) {
  const qty = Math.max(0, Number(p.quantity) || 0)
  const price = Math.max(
    0,
    Number(p.avgPrice) || Number(p.avgUnitPrice) || Number(p.unitPrice) || 0,
  )
  if (!p.name || qty <= 0 || price <= 0) return null
  const now = Date.now()
  return {
    id: createTradeId(),
    date: String(p.buyDate ?? p.date ?? todayDateKey()),
    action: "buy",
    name: String(p.name).trim(),
    ticker: String(p.ticker ?? "").trim() || undefined,
    country: p.country === "kr" ? "kr" : "us",
    quantity: qty,
    unitPrice: price,
    amount: Math.round(price * qty),
    memo: String(p.memo ?? "legacy-migrate"),
    createdAt: Number(p.createdAt) || now,
    updatedAt: now,
  }
}

/** @param {unknown} raw */
function parseHoldingsArray(raw) {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    if (parsed && typeof parsed === "object") {
      if (Array.isArray(parsed.trades)) return parsed.trades
      if (Array.isArray(parsed.holdings)) return parsed.holdings
    }
  } catch {
    /* ignore */
  }
  return []
}

/** @param {unknown[]} items @param {string} storageKey */
function tradesFromLegacyItems(items, storageKey) {
  const now = Date.now()
  /** @type {PortfolioTrade[]} */
  const out = []
  for (const item of items) {
    if (!item || typeof item !== "object") continue
    const row = /** @type {Record<string, unknown>} */ (item)
    if (typeof row.id === "string" && row.action) {
      out.push(/** @type {PortfolioTrade} */ (row))
      continue
    }
    const asTrade = positionLikeToTrade(row)
    if (asTrade) {
      asTrade.memo = `legacy-recover:${storageKey}`
      out.push(asTrade)
    }
  }
  if (out.length) {
    console.info("[portfolio] recovered from legacy key", { key: storageKey, count: out.length })
  }
  return out
}

/** @returns {PortfolioTrade[]} */
function migrateLegacyPositionsKeyToTrades(trades, storageKey) {
  if (trades.length > 0) return trades
  try {
    const raw = localStorage.getItem(storageKey)
    const items = parseHoldingsArray(raw)
    if (!items.length) return trades
    const buyTrades = tradesFromLegacyItems(items, storageKey).filter(
      (t) => t.action === "buy" && (t.quantity ?? 0) > 0,
    )
    if (!buyTrades.length) return trades
    return [...buyTrades, ...trades]
  } catch {
    return trades
  }
}

/** @returns {PortfolioTrade[]} */
function migrateLegacyAliasKeys(trades) {
  if (trades.length > 0) return trades
  for (const key of PORTFOLIO_LEGACY_ALIAS_KEYS) {
    const merged = migrateLegacyPositionsKeyToTrades(trades, key)
    if (merged.length > trades.length) return merged
  }
  return trades
}

/** @returns {PortfolioTrade[]} */
function migrateManualPositionsToTrades(trades) {
  try {
    if (localStorage.getItem(MANUAL_TO_TRADES_KEY)) {
      return migrateLegacyPositionsKeyToTrades(
        migrateLegacyPositionsKeyToTrades(trades, MANUAL_POSITIONS_KEY),
        PORTFOLIO_POSITIONS_KEY,
      )
    }
    const raw = localStorage.getItem(MANUAL_POSITIONS_KEY)
    if (!raw) {
      localStorage.setItem(MANUAL_TO_TRADES_KEY, "1")
      return migrateLegacyPositionsKeyToTrades(trades, PORTFOLIO_POSITIONS_KEY)
    }
    const manual = JSON.parse(raw)
    if (!Array.isArray(manual) || !manual.length) {
      localStorage.setItem(MANUAL_TO_TRADES_KEY, "1")
      return migrateLegacyPositionsKeyToTrades(trades, PORTFOLIO_POSITIONS_KEY)
    }
    const now = Date.now()
    const buyTrades = manual
      .map((p) => positionLikeToTrade(p))
      .filter(Boolean)
      .map((t) => {
        t.memo = "V4 이전 보유 이전"
        t.createdAt = t.createdAt ?? now
        return t
      })
    localStorage.setItem(MANUAL_TO_TRADES_KEY, "1")
    localStorage.removeItem(MANUAL_POSITIONS_KEY)
    const merged = [...buyTrades, ...trades]
    if (merged.length > trades.length) savePortfolioTrades(merged)
    return merged
  } catch {
    return migrateLegacyPositionsKeyToTrades(trades, PORTFOLIO_POSITIONS_KEY)
  }
}

/** @returns {PortfolioTrade[]} */
export function loadPortfolioTrades() {
  /** @type {string | null} */
  let migratedFrom = null
  try {
    const raw = localStorage.getItem(PORTFOLIO_TRADES_KEY)
    let base = []
    let sourceKey = PORTFOLIO_TRADES_KEY

    if (!raw) {
      base = migrateTradesFromActionLog()
      if (base.length) sourceKey = PORTFOLIO_TRADES_KEY
    } else {
      const parsed = JSON.parse(raw)
      base = Array.isArray(parsed) ? parsed.filter((t) => t && typeof t.id === "string") : migrateTradesFromActionLog()
    }

    const beforeLegacy = base.length
    base = migrateLegacyAliasKeys(base)
    if (base.length > beforeLegacy && !migratedFrom) {
      migratedFrom = "legacy-alias"
    }

    const before = base.length
    const result = migrateManualPositionsToTrades(base)
    if (result.length > before && !migratedFrom) {
      migratedFrom = MANUAL_POSITIONS_KEY
    }
    if (result.length > beforeLegacy && beforeLegacy === 0 && !migratedFrom) {
      migratedFrom = "yds-portfolio-manual-v1|yds-portfolio-positions-v1"
    }
    if (result.length > before) savePortfolioTrades(result)

    lastLoadMeta = { sourceKey, migratedFrom }
    return result
  } catch {
    const result = migrateManualPositionsToTrades(migrateLegacyAliasKeys(migrateTradesFromActionLog()))
    if (result.length) savePortfolioTrades(result)
    lastLoadMeta = { sourceKey: PORTFOLIO_TRADES_KEY, migratedFrom: migratedFrom ?? "error-recover" }
    return result
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
