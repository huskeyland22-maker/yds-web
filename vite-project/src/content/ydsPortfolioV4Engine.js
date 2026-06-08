/**
 * YDS Portfolio V4 — 거래 기반 자동 포트폴리오
 */

import { computeCompliance } from "./ydsComplianceEngine.js"
import {
  computeRecommendedAssetAllocation,
  deriveAssetRebalance,
} from "./ydsPortfolioAllocationEngine.js"
import { inferCountryFromName, normalizePositionName } from "./ydsPortfolioTradeSync.js"

/** @typedef {import("./ydsPortfolioTradesStorage.js").PortfolioTrade} PortfolioTrade */
/** @typedef {import("./ydsMarketAdapter.js").YdsMarketAdapterContext} YdsMarketAdapterContext */

/**
 * @typedef {{
 *   id: string
 *   name: string
 *   country: 'us' | 'kr'
 *   costBasis: number
 *   holdingAmount: number
 *   realizedPnl: number
 *   firstBuyDate: string
 * }} AmountLot
 */

/**
 * @typedef {AmountLot & {
 *   purchaseAmount: number
 *   weightPct: number
 *   unrealizedPnl: number | null
 * }} HoldingRow
 */

/**
 * @param {PortfolioTrade[]} trades
 */
export function replayPortfolioFromTrades(trades) {
  /** @type {Map<string, AmountLot>} */
  const map = new Map()
  let totalRealizedPnl = 0

  const sorted = [...trades].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date)
    if (byDate !== 0) return byDate
    return a.createdAt - b.createdAt
  })

  for (const trade of sorted) {
    if (trade.action === "watch") continue

    const amount = Math.round(Number(trade.amount) || 0)
    if (amount <= 0) continue

    const name = String(trade.name ?? "").trim()
    if (!name) continue

    const key = normalizePositionName(name)
    const country = trade.country ?? inferCountryFromName(name)

    if (trade.action === "buy") {
      const existing = map.get(key)
      if (!existing) {
        map.set(key, {
          id: key,
          name,
          country,
          costBasis: amount,
          holdingAmount: amount,
          realizedPnl: 0,
          firstBuyDate: trade.date,
        })
      } else {
        existing.costBasis += amount
        existing.holdingAmount += amount
        if (!existing.country && country) existing.country = country
      }
      continue
    }

    if (trade.action === "sell") {
      const lot = map.get(key)
      if (!lot || lot.holdingAmount <= 0) continue

      const proceeds = amount
      if (proceeds >= lot.holdingAmount) {
        const realized = proceeds - lot.costBasis
        totalRealizedPnl += realized
        map.delete(key)
      } else {
        const proportion = proceeds / lot.holdingAmount
        const costRemoved = Math.round(lot.costBasis * proportion)
        const realized = proceeds - costRemoved
        lot.realizedPnl += realized
        totalRealizedPnl += realized
        lot.costBasis -= costRemoved
        lot.holdingAmount -= proceeds
      }
    }
  }

  return {
    lots: Array.from(map.values()).filter((l) => l.holdingAmount > 0),
    totalRealizedPnl,
  }
}

/**
 * @param {PortfolioTrade[]} trades
 * @param {number} cashAmount
 */
export function buildV4Holdings(trades, cashAmount) {
  const { lots, totalRealizedPnl } = replayPortfolioFromTrades(trades)
  const cash = Math.max(0, Number(cashAmount) || 0)
  const stockTotal = lots.reduce((sum, l) => sum + l.holdingAmount, 0)
  const totalValue = stockTotal + cash
  const cashPct = totalValue > 0 ? Math.round((cash / totalValue) * 1000) / 10 : 0

  /** @type {HoldingRow[]} */
  const rows = lots.map((lot) => ({
    ...lot,
    purchaseAmount: lot.costBasis,
    weightPct: totalValue > 0 ? Math.round((lot.holdingAmount / totalValue) * 1000) / 10 : 0,
    unrealizedPnl: null,
  }))

  return {
    rows,
    lots,
    totalValue,
    stockTotal,
    cashAmount: cash,
    cashPct,
    totalRealizedPnl,
  }
}

/**
 * @param {AmountLot[]} lots
 * @param {number} cashAmount
 */
export function computeAllocationFromLots(lots, cashAmount) {
  let usVal = 0
  let krVal = 0
  for (const lot of lots) {
    if (lot.country === "kr") krVal += lot.holdingAmount
    else usVal += lot.holdingAmount
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
 */
export function buildV4Analysis(trades, cashAmount, context) {
  const { lots } = replayPortfolioFromTrades(trades)
  const asset = computeAllocationFromLots(lots, cashAmount)
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
  const sorted = [...trades].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date)
    if (byDate !== 0) return byDate
    return a.createdAt - b.createdAt
  })
  for (const t of sorted) {
    const amt = Math.round(Number(t.amount) || 0)
    if (amt <= 0) continue
    if (t.action === "sell") cash += amt
    if (t.action === "buy") cash -= amt
  }
  return Math.max(0, cash)
}
