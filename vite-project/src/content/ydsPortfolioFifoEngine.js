/**
 * Phase 6-2 — FIFO 실현손익 엔진
 */

import { PORTFOLIO_USDKRW_DEFAULT } from "./ydsPortfolioPriceProvider.js"
import { inferCountryFromName, normalizePositionName } from "./ydsPortfolioTradeSync.js"
import { tradeAmountKrw, tradeLocalAmount } from "./ydsPortfolioV5Engine.js"

/** @typedef {import("./ydsPortfolioTradesStorage.js").PortfolioTrade} PortfolioTrade */

/**
 * @typedef {{
 *   qty: number
 *   unitPrice: number
 *   costLocal: number
 *   date: string
 *   tradeId: string
 * }} FifoBuyLot
 */

/**
 * One saved sell that actually closed quantity. Partial and full sells each count once.
 * @typedef {{
 *   id: string
 *   date: string
 *   name: string
 *   ticker: string
 *   country: 'us' | 'kr'
 *   currency: 'USD' | 'KRW'
 *   quantity: number
 *   sellPrice: number
 *   proceeds: number
 *   cost: number
 *   fee: number
 *   tax: number
 *   realizedLocal: number
 *   returnPct: number | null
 *   fxRate: number | null
 *   fxRateUsed: number | null
 *   fxSource: 'recorded' | 'live' | null
 *   realizedKrw: number | null
 *   costKrw: number | null
 *   links: { buyTradeId: string, buyDate: string, quantity: number, unitPrice: number }[]
 *   fullClose: boolean
 *   memo: string
 * }} SellSettlement
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
/**
 * Signed local amount to KRW. Losses stay negative.
 * A missing USD rate uses the same fallback the holdings view already uses.
 * @param {'us' | 'kr'} country
 * @param {number} localAmount
 * @param {number | null | undefined} rate
 */
function signedToKrw(country, localAmount, rate) {
  const n = Number(localAmount)
  if (!Number.isFinite(n) || n === 0) return 0
  if (country !== "us") return Math.round(n)
  const fx = rate > 0 ? rate : PORTFOLIO_USDKRW_DEFAULT
  return Math.round(n * fx)
}

function round4(n) {
  return Math.round(Number(n) * 10000) / 10000
}

/**
 * Fill a sell from the oldest buy lots. Does not consume more than the open quantity.
 * @param {FifoBuyLot[]} queue
 * @param {number} sellQty
 * @param {number} sellUnitPrice
 */
function consumeFifo(queue, sellQty, sellUnitPrice) {
  let remaining = sellQty
  let realized = 0
  let cost = 0
  let filled = 0
  /** @type {{ buyTradeId: string, buyDate: string, quantity: number, unitPrice: number }[]} */
  const links = []

  while (remaining > 1e-9 && queue.length > 0) {
    const lot = queue[0]
    const take = Math.min(remaining, lot.qty)
    const lotCost = take * lot.unitPrice
    realized += take * sellUnitPrice - lotCost
    cost += lotCost
    filled += take
    links.push({
      buyTradeId: lot.tradeId || "",
      buyDate: lot.date,
      quantity: take,
      unitPrice: lot.unitPrice,
    })
    lot.qty -= take
    lot.costLocal -= lotCost
    remaining -= take
    if (lot.qty <= 1e-9) queue.shift()
  }

  return { realized, cost, filled, links }
}

/**
 * @param {PortfolioTrade[]} trades
 * @param {number | null | undefined} [usdkrw] live USD/KRW rate; does not replace a rate stored on the sell
 * @returns {{ lots: PositionLot[], closedLots: PositionLot[], totalRealizedPnl: number, settlements: SellSettlement[] }}
 */
export function replayPortfolioFifoFromTrades(trades, usdkrw) {
  /** @type {Map<string, { lot: PositionLot, fifo: FifoBuyLot[] }>} */
  const map = new Map()
  /** @type {PositionLot[]} */
  const closedLots = []
  /** @type {SellSettlement[]} */
  const settlements = []
  let totalRealizedPnl = 0
  const liveRate = Number(usdkrw) > 0 ? Number(usdkrw) : null
  const safeTrades = Array.isArray(trades) ? trades : []

  for (const trade of sortTrades(safeTrades)) {
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
          tradeId: trade.id,
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

        const consumed = consumeFifo(entry.fifo, qty, unitPrice)
        if (consumed.filled <= 0) continue
        const fee = Math.max(0, Number(trade.fee) || 0)
        const tax = Math.max(0, Number(trade.tax) || 0)
        const realizedLocal = round4(consumed.realized - fee - tax)
        const storedRate = Number(trade.fxRate)
        const recordedRate = storedRate > 0 ? storedRate : null
        const rate = entry.lot.country === "us" ? recordedRate ?? liveRate : null
        const realizedKrw = signedToKrw(entry.lot.country, realizedLocal, rate)
        entry.lot.realizedPnl += realizedKrw
        totalRealizedPnl += realizedKrw

        if (consumed.filled > 0) {
          const cost = round4(consumed.cost)
          const currency = entry.lot.country === "kr" ? "KRW" : "USD"
          const costKrw = currency === "KRW" ? Math.round(cost) : rate ? Math.round(cost * rate) : null
          const converted = currency === "KRW" ? Math.round(realizedLocal) : rate ? Math.round(realizedLocal * rate) : null
          settlements.push({
            id: trade.id,
            date: trade.date,
            name,
            ticker: ticker || entry.lot.ticker || "",
            country: entry.lot.country,
            currency,
            quantity: round4(consumed.filled),
            sellPrice: unitPrice,
            proceeds: round4(consumed.filled * unitPrice),
            cost,
            fee,
            tax,
            realizedLocal,
            returnPct: cost > 0 ? Math.round((realizedLocal / cost) * 1000) / 10 : null,
            fxRate: recordedRate,
            fxRateUsed: currency === "USD" ? rate : null,
            fxSource: currency === "KRW" ? null : recordedRate ? "recorded" : rate ? "live" : null,
            realizedKrw: converted,
            costKrw,
            links: consumed.links,
            fullClose: false,
            memo: String(trade.memo ?? ""),
          })
        }

        const agg = syncAggregateFromFifo(entry.fifo)
        if (settlements.length && settlements[settlements.length - 1].id === trade.id) {
          settlements[settlements.length - 1].fullClose = agg.quantity <= 0
        }
        if (agg.quantity <= 0) {
          closedLots.push({ ...entry.lot, quantity: 0, costBasisLocal: 0 })
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
        closedLots.push({
          ...lot,
          quantity: 0,
          holdingAmount: 0,
          realizedPnl: (lot.realizedPnl || 0) + realized,
        })
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

  return { lots, closedLots, totalRealizedPnl, settlements }
}
