/**
 * YDS Portfolio V2 — 보유·배분·분석 엔진
 */

import { computeCompliance } from "./ydsComplianceEngine.js"
import {
  computeRecommendedAssetAllocation,
  deriveAssetRebalance,
} from "./ydsPortfolioAllocationEngine.js"

/** @typedef {import("./ydsPortfolioPositionsStorage.js").PortfolioPosition} PortfolioPosition */
/** @typedef {import("./ydsMarketAdapter.js").YdsMarketAdapterContext} YdsMarketAdapterContext */

/**
 * @typedef {PortfolioPosition & {
 *   markPrice: number
 *   valuation: number
 *   returnPct: number | null
 *   weightPct: number
 * }} PositionRow
 */

/**
 * @param {PortfolioPosition} position
 * @param {number} totalValue
 * @returns {PositionRow}
 */
export function computePositionRow(position, totalValue) {
  const markPrice =
    position.currentPrice != null && position.currentPrice > 0
      ? position.currentPrice
      : position.avgPrice
  const valuation = Math.round(markPrice * position.quantity)
  const returnPct =
    position.avgPrice > 0
      ? Math.round(((markPrice - position.avgPrice) / position.avgPrice) * 1000) / 10
      : null
  const weightPct =
    totalValue > 0 ? Math.round((valuation / totalValue) * 1000) / 10 : 0

  return {
    ...position,
    markPrice,
    valuation,
    returnPct,
    weightPct,
  }
}

/**
 * @param {PortfolioPosition[]} positions
 * @param {number} cashAmount
 */
export function computeActualAssetAllocation(positions, cashAmount) {
  let usVal = 0
  let krVal = 0
  for (const p of positions) {
    const mark = p.currentPrice != null && p.currentPrice > 0 ? p.currentPrice : p.avgPrice
    const val = mark * p.quantity
    if (p.country === "kr") krVal += val
    else usVal += val
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
 * @param {PortfolioPosition[]} positions
 * @param {number} cashAmount
 * @param {YdsMarketAdapterContext} context
 */
export function buildPortfolioV2Analysis(positions, cashAmount, context) {
  const asset = computeActualAssetAllocation(positions, cashAmount)
  const recommended = computeRecommendedAssetAllocation(context)
  const actual = {
    usPct: asset.usPct,
    krPct: asset.krPct,
    cashPct: asset.cashPct,
  }
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

/**
 * @param {PortfolioPosition[]} positions
 * @param {number} cashAmount
 */
export function buildPositionRows(positions, cashAmount) {
  const asset = computeActualAssetAllocation(positions, cashAmount)
  const rows = positions.map((p) => computePositionRow(p, asset.total))
  return { rows, totalValue: asset.total, asset }
}

/**
 * @param {PortfolioPosition[]} positions
 * @param {number} cashAmount
 */
export function buildPortfolioSummary(positions, cashAmount) {
  const { rows, totalValue, asset } = buildPositionRows(positions, cashAmount)
  const costBasis = positions.reduce(
    (sum, p) => sum + Math.round(p.avgPrice * p.quantity),
    0,
  )
  const stockVal = rows.reduce((sum, r) => sum + r.valuation, 0)
  const totalReturnPct =
    costBasis > 0 ? Math.round(((stockVal - costBasis) / costBasis) * 1000) / 10 : null
  const cashPct =
    totalValue > 0 ? Math.round((asset.cashVal / totalValue) * 1000) / 10 : 0

  return {
    rows,
    totalValue,
    totalReturnPct,
    cashPct,
    stockVal,
    cashAmount: asset.cashVal,
    costBasis,
  }
}

/** @param {'buy' | 'sell' | 'watch'} action */
export function tradeActionLabel(action) {
  if (action === "buy") return "매수"
  if (action === "sell") return "매도"
  return "관망"
}

export function formatKrw(n) {
  if (n == null || !Number.isFinite(n)) return "—"
  return `${Math.round(n).toLocaleString("ko-KR")}원`
}

/**
 * @param {number} amount
 * @param {number} quantity
 */
export function deriveUnitPrice(amount, quantity) {
  const qty = Number(quantity) || 0
  const amt = Number(amount) || 0
  if (qty <= 0 || amt <= 0) return 0
  return Math.round(amt / qty)
}
