/**
 * Phase 6-2 — FIFO 실현손익 엔진
 */

import { toKrwValue } from "./ydsPortfolioPriceProvider.js"
import { inferCountryFromName, normalizePositionName } from "./ydsPortfolioTradeSync.js"
import { tradeAmountKrw, tradeLocalAmount } from "./ydsPortfolioV5Engine.js"

/** @typedef {import("./ydsPortfolioTradesStorage.js").PortfolioTrade} PortfolioTrade */

/**
 * @typedef {{
 *   qty: number
 *   unitPrice: number
 *   costLocal: number
 *   date: string
 * }} FifoBuyLot
 */

/**
 * @typedef {{
 *   id: string
 *   name: string
 *   ticker: string
 *   country: 'us' | 'kr'
 *   quantity: number
 *   avgUnitPrice: number
 *   costBasisLocal: number
 *   realizedPnl: number
 *   firstBuyDate: string
 *   priceReady: boolean
 *   holdingAmount?: number
 *   costBasis?: number
 * }} PositionLot
 */

/**
 * @param {PortfolioTrade} trade
 */
function qtyAndUnit(trade) {
  const qty = Number(trade.quantity) || 0
  const unit = Number(trade.unitPrice) || 0
  return qty > 0 && unit > 0
}

/**
 * @param {PortfolioTrade[]} trades
 */
function sortTrades(trades) {
  return [...trades].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date)
    if (byDate !== 0) return byDate
    return a.createdAt - b.createdAt
  })
}

/**
 * @param {FifoBuyLot[]} queue
 */
function syncAggregateFromFifo(queue) {
  const quantity = queue.reduce((sum, l) => sum + l.qty, 0)
  const costBasisLocal = queue.reduce((sum, l) => sum + l.costLocal, 0)
  const avgUnitPrice = quantity > 0 ? costBasisLocal / quantity : 0
  return { quantity, costBasisLocal, avgUnitPrice }
}

/**
 * @param {FifoBuyLot[]} queue
 * @param {number} sellQty
 * @param {number} sellUnitPrice
 */
function fifoRealizedLocal(queue, sellQty, sellUnitPrice) {
  let remaining = sellQty
  let realized = 0

  while (remaining > 0 && queue.length > 0) {
    const lot = queue[0]
    const take = Math.min(remaining, lot.qty)
    const proceeds = take * sellUnitPrice
    const cost = take * lot.unitPrice
    realized += proceeds - cost
    lot.qty -= take
    lot.costLocal -= cost
    remaining -= take
    if (lot.qty <= 0) queue.shift()
  }

  return realized
}

/**
 * @param {PortfolioTrade[]} trades
 * @returns {{ lots: PositionLot[], totalRealizedPnl: number }}
 */
export function replayPortfolioFifoFromTrades(trades) {
  /** @type {Map<string, { lot: PositionLot, fifo: FifoBuyLot[] }>} */
  const map = new Map()
  let totalRealizedPnl = 0

  for (const trade of sortTrades(trades)) {
    if (trade.action === "watch") continue

    const name = String(trade.name ?? "").trim()
    if (!name) continue

    const key = normalizePositionName(name)
    const country = trade.country === "kr" ? "kr" : "us"
    const ticker = String(trade.ticker ?? "").trim()

    if (qtyAndUnit(trade)) {
      const qty = Number(trade.quantity) || 0
      const unitPrice = Number(trade.unitPrice) || 0
      const localAmount = qty * unitPrice

      if (trade.action === "buy") {
        let entry = map.get(key)
        if (!entry) {
          entry = {
            lot: {
              id: key,
              name,
              ticker: ticker || "",
              country,
              quantity: 0,
              avgUnitPrice: 0,
              costBasisLocal: 0,
              realizedPnl: 0,
              firstBuyDate: trade.date,
              priceReady: Boolean(ticker),
            },
            fifo: [],
          }
          map.set(key, entry)
        }

        entry.fifo.push({
          qty,
          unitPrice,
          costLocal: localAmount,
          date: trade.date,
        })
        const agg = syncAggregateFromFifo(entry.fifo)
        entry.lot.quantity = agg.quantity
        entry.lot.costBasisLocal = agg.costBasisLocal
        entry.lot.avgUnitPrice = agg.avgUnitPrice
        if (ticker) {
          entry.lot.ticker = ticker
          entry.lot.priceReady = true
        }
        if (!entry.lot.country && country) entry.lot.country = country
        continue
      }

      if (trade.action === "sell") {
        const entry = map.get(key)
        if (!entry || !entry.lot.priceReady || entry.fifo.length === 0) continue

        const realizedLocal = fifoRealizedLocal(entry.fifo, qty, unitPrice)
        const realizedKrw = toKrwValue(entry.lot.country, realizedLocal)
        entry.lot.realizedPnl += realizedKrw
        totalRealizedPnl += realizedKrw

        const agg = syncAggregateFromFifo(entry.fifo)
        if (agg.quantity <= 0) {
          map.delete(key)
        } else {
          entry.lot.quantity = agg.quantity
          entry.lot.costBasisLocal = agg.costBasisLocal
          entry.lot.avgUnitPrice = agg.avgUnitPrice
        }
      }
      continue
    }

    const amountKrw = tradeAmountKrw(trade)
    if (amountKrw <= 0) continue

    if (trade.action === "buy") {
      let entry = map.get(key)
      if (entry?.lot.priceReady) continue

      if (!entry) {
        entry = {
          lot: {
            id: key,
            name,
            ticker: ticker || "",
            country,
            quantity: 0,
            avgUnitPrice: 0,
            costBasisLocal: 0,
            realizedPnl: 0,
            firstBuyDate: trade.date,
            priceReady: false,
            holdingAmount: amountKrw,
            costBasis: amountKrw,
          },
          fifo: [],
        }
        map.set(key, entry)
      } else {
        entry.lot.holdingAmount = (entry.lot.holdingAmount ?? 0) + amountKrw
        entry.lot.costBasis = (entry.lot.costBasis ?? 0) + amountKrw
        if (!entry.lot.country && country) entry.lot.country = country
      }
      continue
    }

    if (trade.action === "sell") {
      const entry = map.get(key)
      if (!entry?.lot || entry.lot.priceReady) continue

      const lot = entry.lot
      const holding = lot.holdingAmount ?? 0
      if (holding <= 0) continue

      const proceeds = amountKrw
      if (proceeds >= holding) {
        const realized = proceeds - (lot.costBasis ?? 0)
        totalRealizedPnl += realized
        map.delete(key)
      } else {
        const proportion = proceeds / holding
        const costRemoved = Math.round((lot.costBasis ?? 0) * proportion)
        const realized = proceeds - costRemoved
        lot.realizedPnl += realized
        totalRealizedPnl += realized
        lot.costBasis = (lot.costBasis ?? 0) - costRemoved
        lot.holdingAmount = holding - proceeds
      }
    }
  }

  const lots = Array.from(map.values())
    .map((e) => e.lot)
    .filter((l) => {
      if (l.priceReady) return l.quantity > 0
      return (l.holdingAmount ?? 0) > 0
    })

  return { lots, totalRealizedPnl }
}
