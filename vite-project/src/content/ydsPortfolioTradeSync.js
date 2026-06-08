/**
 * YDS Portfolio V2.1 — 매매 기록 ↔ 보유 종목 연동
 */

import { createPositionId } from "./ydsPortfolioPositionsStorage.js"
import { deriveUnitPrice } from "./ydsPortfolioV2Engine.js"

/** @typedef {import("./ydsPortfolioPositionsStorage.js").PortfolioPosition} PortfolioPosition */
/** @typedef {import("./ydsPortfolioTradesStorage.js").PortfolioTrade} PortfolioTrade */

/**
 * @typedef {PortfolioPosition & { source?: 'manual' | 'trade' }} HoldingPosition
 */

/** @param {string} name */
export function normalizePositionName(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
}

/** @param {string} name */
export function inferCountryFromName(name) {
  const t = String(name).trim()
  if (/^\d{6}$/.test(t)) return "kr"
  return "us"
}

/**
 * @param {HoldingPosition[]} positions
 * @param {string} name
 */
export function findPositionByName(positions, name) {
  const key = normalizePositionName(name)
  return positions.find((p) => normalizePositionName(p.name) === key) ?? null
}

/**
 * @param {HoldingPosition[]} positions
 * @param {{
 *   name: string
 *   quantity: number
 *   amount?: number | null
 *   avgPrice?: number
 *   date?: string
 *   country?: 'us' | 'kr'
 * }} input
 */
export function applyBuyToPositions(positions, input) {
  const name = String(input.name ?? "").trim()
  const qty = Math.max(0, Number(input.quantity) || 0)
  if (!name || qty <= 0) return positions

  const unitPrice =
    input.avgPrice != null && input.avgPrice > 0
      ? Math.round(input.avgPrice)
      : deriveUnitPrice(input.amount ?? 0, qty)
  const date = input.date ?? new Date().toISOString().slice(0, 10)
  const country = input.country ?? inferCountryFromName(name)
  const existing = findPositionByName(positions, name)

  if (!existing) {
    const now = Date.now()
    const created = {
      id: createPositionId(),
      name,
      ticker: /^\d{6}$/.test(name) ? name : "",
      country,
      buyDate: date,
      avgPrice: unitPrice,
      quantity: qty,
      currentPrice: unitPrice > 0 ? unitPrice : null,
      createdAt: now,
      updatedAt: now,
      source: "trade",
    }
    return [...positions, created]
  }

  const newQty = existing.quantity + qty
  const newAvg =
    unitPrice > 0
      ? Math.round((existing.avgPrice * existing.quantity + unitPrice * qty) / newQty)
      : existing.avgPrice
  const newMark = unitPrice > 0 ? unitPrice : existing.currentPrice

  return positions.map((p) =>
    p.id === existing.id
      ? {
          ...p,
          quantity: newQty,
          avgPrice: newAvg,
          currentPrice: newMark,
          buyDate: p.buyDate || date,
          updatedAt: Date.now(),
          source: "trade",
        }
      : p,
  )
}

/**
 * @param {HoldingPosition[]} positions
 * @param {{ name: string; quantity: number }} input
 */
export function applySellToPositions(positions, input) {
  const name = String(input.name ?? "").trim()
  const qty = Math.max(0, Number(input.quantity) || 0)
  if (!name || qty <= 0) return positions

  const existing = findPositionByName(positions, name)
  if (!existing) return positions

  const newQty = existing.quantity - qty
  if (newQty <= 0) {
    return positions.filter((p) => p.id !== existing.id)
  }

  return positions.map((p) =>
    p.id === existing.id ? { ...p, quantity: newQty, updatedAt: Date.now() } : p,
  )
}

/**
 * @param {HoldingPosition[]} positions
 * @param {PortfolioTrade} trade
 */
export function applyTradeToPositions(positions, trade) {
  if (trade.action === "watch") return positions
  const qty = Number(trade.quantity) || 0
  if (trade.action === "buy") {
    return applyBuyToPositions(positions, {
      name: trade.name,
      quantity: qty,
      amount: trade.amount,
      date: trade.date,
    })
  }
  if (trade.action === "sell") {
    return applySellToPositions(positions, { name: trade.name, quantity: qty })
  }
  return positions
}

/**
 * @param {PortfolioPosition[]} manualPositions
 * @param {PortfolioTrade[]} trades
 * @returns {HoldingPosition[]}
 */
export function computeHoldingsFromTrades(manualPositions, trades) {
  /** @type {HoldingPosition[]} */
  let positions = manualPositions.map((p) => ({
    ...p,
    source: "manual",
  }))

  const sorted = [...trades].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date)
    if (byDate !== 0) return byDate
    return a.createdAt - b.createdAt
  })

  for (const trade of sorted) {
    positions = applyTradeToPositions(positions, trade)
  }

  return positions.filter((p) => p.quantity > 0)
}
