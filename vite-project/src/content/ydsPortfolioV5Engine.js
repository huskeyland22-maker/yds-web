/**
 * YDS Portfolio V5 — 현재가 연동 자동 포트폴리오
 */

import { computeCompliance } from "./ydsComplianceEngine.js"
import {
  computeRecommendedAssetAllocation,
  deriveAssetRebalance,
} from "./ydsPortfolioAllocationEngine.js"
import { toKrwValue } from "./ydsPortfolioPriceProvider.js"
import { quotePrice } from "./ydsPortfolioQuoteTypes.js"

/** @typedef {import("./ydsPortfolioQuoteTypes.js").PortfolioQuote} PortfolioQuote */
import { inferCountryFromName, normalizePositionName } from "./ydsPortfolioTradeSync.js"

/** @typedef {import("./ydsPortfolioTradesStorage.js").PortfolioTrade} PortfolioTrade */
/** @typedef {import("./ydsMarketAdapter.js").YdsMarketAdapterContext} YdsMarketAdapterContext */

/**
 * @typedef {'returnPct' | 'unrealizedPnl' | 'weightPct'} HoldingsSortKey
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
 * @typedef {PositionLot & {
 *   currentPrice: number | null
 *   marketValueKrw: number
 *   costBasisKrw: number
 *   unrealizedPnl: number | null
 *   returnPct: number | null
 *   weightPct: number
 *   priceStatus: import("./ydsPortfolioQuoteTypes.js").PortfolioQuoteStatus | null
 *   priceUpdatedAt: string | null
 *   priceStale: boolean
 * }} HoldingRow
 */

/**
 * @param {PortfolioTrade} trade
 */
export function tradeLocalAmount(trade) {
  const qty = Number(trade.quantity) || 0
  const unit = Number(trade.unitPrice) || 0
  if (qty > 0 && unit > 0) return qty * unit
  return Math.max(0, Number(trade.amount) || 0)
}

/**
 * @param {PortfolioTrade} trade
 */
export function tradeAmountKrw(trade) {
  const country = trade.country === "kr" ? "kr" : "us"
  const local = tradeLocalAmount(trade)
  if (local <= 0) return 0
  if (qtyAndUnit(trade)) return toKrwValue(country, local)
  return Math.round(local)
}

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
 * @param {PortfolioTrade[]} trades
 */
export function replayPortfolioFromTrades(trades) {
  /** @type {Map<string, PositionLot>} */
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
        const existing = map.get(key)
        if (existing?.priceReady) {
          const newQty = existing.quantity + qty
          const newCost = existing.costBasisLocal + localAmount
          existing.quantity = newQty
          existing.costBasisLocal = newCost
          existing.avgUnitPrice = newQty > 0 ? newCost / newQty : unitPrice
          if (ticker) existing.ticker = ticker
          if (!existing.country && country) existing.country = country
        } else if (existing && existing.quantity > 0) {
          const newQty = existing.quantity + qty
          const newCost = existing.costBasisLocal + localAmount
          existing.quantity = newQty
          existing.costBasisLocal = newCost
          existing.avgUnitPrice = newQty > 0 ? newCost / newQty : unitPrice
          if (ticker) {
            existing.ticker = ticker
            existing.priceReady = true
          }
          if (!existing.country && country) existing.country = country
        } else {
          map.set(key, {
            id: key,
            name,
            ticker: ticker || "",
            country,
            quantity: qty,
            avgUnitPrice: unitPrice,
            costBasisLocal: localAmount,
            realizedPnl: 0,
            firstBuyDate: trade.date,
            priceReady: Boolean(ticker),
          })
        }
        continue
      }

      if (trade.action === "sell") {
        const lot = map.get(key)
        if (!lot || !lot.priceReady || lot.quantity <= 0) continue

        const proceeds = localAmount
        if (qty >= lot.quantity) {
          const realized = proceeds - lot.costBasisLocal
          totalRealizedPnl += toKrwValue(lot.country, realized)
          map.delete(key)
        } else {
          const proportion = qty / lot.quantity
          const costRemoved = lot.costBasisLocal * proportion
          const realized = proceeds - costRemoved
          lot.realizedPnl += toKrwValue(lot.country, realized)
          totalRealizedPnl += toKrwValue(lot.country, realized)
          lot.costBasisLocal -= costRemoved
          lot.quantity -= qty
          lot.avgUnitPrice = lot.quantity > 0 ? lot.costBasisLocal / lot.quantity : 0
        }
      }
      continue
    }

    const amountKrw = tradeAmountKrw(trade)
    if (amountKrw <= 0) continue

    if (trade.action === "buy") {
      const existing = map.get(key)
      if (existing?.priceReady) continue

      if (!existing) {
        map.set(key, {
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
        })
      } else {
        existing.holdingAmount = (existing.holdingAmount ?? 0) + amountKrw
        existing.costBasis = (existing.costBasis ?? 0) + amountKrw
        if (!existing.country && country) existing.country = country
      }
      continue
    }

    if (trade.action === "sell") {
      const lot = map.get(key)
      if (!lot) continue

      if (lot.priceReady) continue

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

  const lots = Array.from(map.values()).filter((l) => {
    if (l.priceReady) return l.quantity > 0
    return (l.holdingAmount ?? 0) > 0
  })

  return { lots, totalRealizedPnl }
}

/**
 * @param {PositionLot} lot
 * @param {PortfolioQuote | number | null | undefined} quoteOrPrice
 * @param {number} [usdkrw]
 */
function enrichLot(lot, quoteOrPrice, usdkrw) {
  if (!lot.priceReady) {
    const costKrw = lot.costBasis ?? lot.holdingAmount ?? 0
    return {
      ...lot,
      currentPrice: null,
      marketValueKrw: costKrw,
      costBasisKrw: costKrw,
      unrealizedPnl: null,
      returnPct: null,
      weightPct: 0,
      priceStatus: null,
      priceUpdatedAt: null,
      priceStale: false,
    }
  }

  const quote = typeof quoteOrPrice === "object" && quoteOrPrice != null ? quoteOrPrice : null
  const price = quotePrice(quoteOrPrice)
  const costKrw = toKrwValue(lot.country, lot.costBasisLocal, usdkrw)
  const marketValueKrw =
    price != null ? toKrwValue(lot.country, lot.quantity * price, usdkrw) : costKrw
  const unrealizedPnl = price != null ? marketValueKrw - costKrw : null
  const returnPct =
    price != null && lot.avgUnitPrice > 0
      ? Math.round(((price - lot.avgUnitPrice) / lot.avgUnitPrice) * 1000) / 10
      : null

  return {
    ...lot,
    currentPrice: price,
    marketValueKrw,
    costBasisKrw: costKrw,
    unrealizedPnl,
    returnPct,
    weightPct: 0,
    priceStatus: quote?.status ?? (price != null ? "delayed" : "error"),
    priceUpdatedAt: quote?.updatedAt ?? null,
    priceStale: Boolean(quote?.stale),
  }
}

/**
 * @param {HoldingRow[]} rows
 * @param {HoldingsSortKey} sortBy
 */
export function sortHoldingRows(rows, sortBy) {
  const sorted = [...rows]
  if (sortBy === "returnPct") {
    sorted.sort((a, b) => (b.returnPct ?? -Infinity) - (a.returnPct ?? -Infinity))
  } else if (sortBy === "unrealizedPnl") {
    sorted.sort((a, b) => (b.unrealizedPnl ?? -Infinity) - (a.unrealizedPnl ?? -Infinity))
  } else {
    sorted.sort((a, b) => b.weightPct - a.weightPct)
  }
  return sorted
}

/**
 * @param {PortfolioTrade[]} trades
 * @param {number} cashAmount
 * @param {Map<string, PortfolioQuote | number>} [quoteMap]
 * @param {HoldingsSortKey} [sortBy]
 * @param {number} [usdkrw]
 */
export function buildV5Holdings(trades, cashAmount, quoteMap, sortBy = "returnPct", usdkrw) {
  const { lots, totalRealizedPnl } = replayPortfolioFromTrades(trades)
  const cash = Math.max(0, Number(cashAmount) || 0)

  /** @type {HoldingRow[]} */
  let rows = lots.map((lot) => {
    const quote = quoteMap?.get(lot.id)
    return enrichLot(lot, quote, usdkrw)
  })

  const stockTotal = rows.reduce((sum, r) => sum + r.marketValueKrw, 0)
  const totalValue = stockTotal + cash
  const totalCostKrw = rows.reduce((sum, r) => sum + r.costBasisKrw, 0)
  const totalUnrealizedPnl = rows.reduce((sum, r) => sum + (r.unrealizedPnl ?? 0), 0)
  const totalPnl = totalRealizedPnl + totalUnrealizedPnl
  const totalReturnPct =
    totalCostKrw > 0 ? Math.round((totalPnl / totalCostKrw) * 1000) / 10 : null
  const cashPct = totalValue > 0 ? Math.round((cash / totalValue) * 1000) / 10 : 0

  rows = rows.map((row) => ({
    ...row,
    weightPct: totalValue > 0 ? Math.round((row.marketValueKrw / totalValue) * 1000) / 10 : 0,
  }))

  rows = sortHoldingRows(rows, sortBy)

  return {
    rows,
    lots,
    totalValue,
    stockTotal,
    cashAmount: cash,
    cashPct,
    totalCostKrw,
    totalRealizedPnl,
    totalUnrealizedPnl,
    totalPnl,
    totalReturnPct,
  }
}

/**
 * @param {PositionLot[]} lots
 * @param {Map<string, PortfolioQuote | number>} [quoteMap]
 * @param {number} cashAmount
 * @param {number} [usdkrw]
 */
export function computeAllocationFromLots(lots, quoteMap, cashAmount, usdkrw) {
  let usVal = 0
  let krVal = 0

  for (const lot of lots) {
    const quote = quoteMap?.get(lot.id)
    const row = enrichLot(lot, quote, usdkrw)
    if (lot.country === "kr") krVal += row.marketValueKrw
    else usVal += row.marketValueKrw
  }

  const cash = Math.max(0, Number(cashAmount) || 0)
  const total = usVal + krVal + cash
  if (total <= 0) {
    return { usPct: 0, krPct: 0, cashPct: 100, usVal: 0, krVal: 0, cashVal: cash, total: cash }
  }
  const usPct = Math.round((usVal / total) * 100)
  const krPct = Math.round((krVal / total) * 100)
  const cashPct = Math.max(0, 100 - usPct - krPct)
  return {
    usPct,
    krPct,
    cashPct,
    usVal: Math.round(usVal),
    krVal: Math.round(krVal),
    cashVal: Math.round(cash),
    total: Math.round(total),
  }
}

/**
 * @param {PortfolioTrade[]} trades
 * @param {number} cashAmount
 * @param {YdsMarketAdapterContext} context
 * @param {Map<string, PortfolioQuote | number>} [quoteMap]
 * @param {number} [usdkrw]
 */
export function buildV5Analysis(trades, cashAmount, context, quoteMap, usdkrw) {
  const { lots } = replayPortfolioFromTrades(trades)
  const asset = computeAllocationFromLots(lots, quoteMap, cashAmount, usdkrw)
  const recommended = computeRecommendedAssetAllocation(context)
  const actual = { usPct: asset.usPct, krPct: asset.krPct, cashPct: asset.cashPct }
  const compliance = computeCompliance(recommended, actual)
  const rebalance = deriveAssetRebalance(recommended, actual)

  return {
    recommended,
    actual,
    asset,
    compliance,
    gapPct: compliance.gapPct,
    compliancePct: compliance.compliancePct,
    rebalance,
  }
}

/** @param {PortfolioTrade[]} trades */
export function deriveCashFromTrades(trades) {
  let cash = 0
  for (const t of sortTrades(trades)) {
    const amt = tradeAmountKrw(t)
    if (amt <= 0) continue
    if (t.action === "sell") cash += amt
    if (t.action === "buy") cash -= amt
  }
  return Math.max(0, cash)
}
