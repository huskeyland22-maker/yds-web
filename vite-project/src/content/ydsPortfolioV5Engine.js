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
import { replayPortfolioFifoFromTrades } from "./ydsPortfolioFifoEngine.js"
import { computePortfolioCash } from "./ydsPortfolioCashEngine.js"

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
export function replayPortfolioFromTrades(trades) {
  return replayPortfolioFifoFromTrades(trades ?? [])
}

/** @returns {ReturnType<typeof buildV5Holdings>} */
export function emptyPortfolioHoldings() {
  return {
    rows: [],
    lots: [],
    totalValue: 0,
    totalAssets: 0,
    stockTotal: 0,
    cashAmount: 0,
    cashPct: 0,
    totalCostKrw: 0,
    totalRealizedPnl: 0,
    totalUnrealizedPnl: 0,
    totalPnl: 0,
    totalReturnPct: null,
  }
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
  const safeTrades = Array.isArray(trades) ? trades : []
  const safeQuoteMap = quoteMap instanceof Map ? quoteMap : new Map()
  const { lots, totalRealizedPnl } = replayPortfolioFromTrades(safeTrades)
  const cash = Math.max(0, Number(cashAmount) || 0)

  /** @type {HoldingRow[]} */
  let rows = lots.map((lot) => {
    const quote = safeQuoteMap.get(lot.id)
    return enrichLot(lot, quote, usdkrw)
  })

  const stockTotal = rows.reduce((sum, r) => sum + r.marketValueKrw, 0)
  const totalAssets = stockTotal + cash
  const totalValue = totalAssets
  const totalCostKrw = rows.reduce((sum, r) => sum + r.costBasisKrw, 0)
  const totalUnrealizedPnl = rows.reduce((sum, r) => sum + (r.unrealizedPnl ?? 0), 0)
  const totalPnl = totalRealizedPnl + totalUnrealizedPnl
  const totalReturnPct =
    totalCostKrw > 0 ? Math.round((totalPnl / totalCostKrw) * 1000) / 10 : null
  const cashPct = totalAssets > 0 ? Math.round((cash / totalAssets) * 1000) / 10 : 0

  rows = rows.map((row) => ({
    ...row,
    weightPct: totalAssets > 0 ? Math.round((row.marketValueKrw / totalAssets) * 1000) / 10 : 0,
  }))

  rows = sortHoldingRows(rows, sortBy)

  return {
    rows,
    lots,
    totalValue,
    totalAssets,
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
  const safeLots = Array.isArray(lots) ? lots : []
  const safeQuoteMap = quoteMap instanceof Map ? quoteMap : new Map()

  for (const lot of safeLots) {
    const quote = safeQuoteMap.get(lot.id)
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
  const safeTrades = Array.isArray(trades) ? trades : []
  const safeQuoteMap = quoteMap instanceof Map ? quoteMap : new Map()
  const { lots } = replayPortfolioFromTrades(safeTrades)
  const asset = computeAllocationFromLots(lots, safeQuoteMap, cashAmount ?? 0, usdkrw)
  const recommended = computeRecommendedAssetAllocation(context ?? {})
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
  return computePortfolioCash(trades, [])
}

export { computePortfolioCash }
