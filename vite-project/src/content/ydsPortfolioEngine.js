/**
 * YDS Phase 3-1 — 포트폴리오 비중 엔진
 * 시장분석 Read-Only Adapter 결과 → 권장 주식·현금 비중
 */

/** @typedef {import("./ydsMarketAdapter.js").YdsMarketAdapterContext} YdsMarketAdapterContext */

/**
 * @typedef {{
 *   stockPct: number
 *   cashPct: number
 *   stockLabel: string
 *   cashLabel: string
 *   note: string
 * }} RecommendedAllocation
 */

/**
 * @typedef {{
 *   stockPct: number
 *   cashPct: number
 * }} HoldingsAllocation
 */

/**
 * @typedef {{
 *   stockDiff: number
 *   cashDiff: number
 *   conclusion: string
 *   actions: string[]
 *   tone: "neutral" | "warning" | "opportunity"
 * }} PortfolioRebalanceView
 */

/** @type {Record<string, { stock: number; cash: number; note: string }>} */
const BASE_ALLOCATION = {
  overheated: { stock: 30, cash: 70, note: "공포 없음 · 현금 확보 우선" },
  neutral: { stock: 45, cash: 55, note: "공포 부족 · 방어적 비중" },
  interest: { stock: 70, cash: 30, note: "관심 구간 · 분할 진입 준비" },
  dca: { stock: 85, cash: 15, note: "분할매수 · 비중 확대" },
  panicBuy: { stock: 95, cash: 5, note: "인생 타점 · 공격적 분할" },
}

/** @type {Record<string, { stock: number; cash: number }>} */
const CYCLE_ADJUST = {
  normal: { stock: 0, cash: 0 },
  warning: { stock: -5, cash: 5 },
  cashPrep: { stock: -10, cash: 10 },
  partialCash: { stock: -15, cash: 15 },
}

/** @type {Record<string, { stock: number; cash: number }>} */
const STATE_ADJUST = {
  recoveryProgress: { stock: 5, cash: -5 },
  optimismExpand: { stock: 0, cash: 0 },
  overheatUnwind: { stock: -5, cash: 5 },
  correction: { stock: -3, cash: 3 },
  panicProgress: { stock: 8, cash: -8 },
}

/** @param {number} n */
function clampPct(n) {
  return Math.max(0, Math.min(100, Math.round(n)))
}

/**
 * @param {YdsMarketAdapterContext} context
 * @returns {RecommendedAllocation}
 */
export function computeRecommendedAllocation(context) {
  const macroId = context.macroId ?? "neutral"
  const base = BASE_ALLOCATION[macroId] ?? BASE_ALLOCATION.neutral

  let stockPct = base.stock
  let cashPct = base.cash

  const cycleAdj = CYCLE_ADJUST[context.cycleStageId] ?? CYCLE_ADJUST.normal
  stockPct += cycleAdj.stock
  cashPct += cycleAdj.cash

  if (context.marketStateId && STATE_ADJUST[context.marketStateId]) {
    stockPct += STATE_ADJUST[context.marketStateId].stock
    cashPct += STATE_ADJUST[context.marketStateId].cash
  }

  if (context.isDefensive && macroId === "neutral") {
    stockPct = Math.min(stockPct, 50)
    cashPct = Math.max(cashPct, 50)
  }

  stockPct = clampPct(stockPct)
  cashPct = clampPct(100 - stockPct)

  return {
    stockPct,
    cashPct,
    stockLabel: `주식 ${stockPct}%`,
    cashLabel: `현금 ${cashPct}%`,
    note: base.note,
  }
}

/**
 * @param {RecommendedAllocation} recommended
 * @param {HoldingsAllocation} current
 * @returns {PortfolioRebalanceView}
 */
export function derivePortfolioRebalance(recommended, current) {
  const stockDiff = current.stockPct - recommended.stockPct
  const cashDiff = current.cashPct - recommended.cashPct

  if (stockDiff >= 12) {
    return {
      stockDiff,
      cashDiff,
      conclusion: "주식 비중 과다 · 현금 확보 필요",
      actions: ["일부 익절", "신규 진입 축소", "현금 확보"],
      tone: "warning",
    }
  }

  if (stockDiff <= -12) {
    return {
      stockDiff,
      cashDiff,
      conclusion: "현금 비중 과다 · 매수 여력 확보",
      actions: ["분할매수 검토", "관심 종목 진입 준비", "현금 활용"],
      tone: "opportunity",
    }
  }

  return {
    stockDiff,
    cashDiff,
    conclusion: "권장 비중 근접 · 유지",
    actions: ["비중 유지", "리밸런싱 불필요", "종목 선별 집중"],
    tone: "neutral",
  }
}

/**
 * @param {YdsMarketAdapterContext} context
 * @param {RecommendedAllocation} recommended
 * @param {HoldingsAllocation} current
 * @param {PortfolioRebalanceView} rebalance
 */
export function buildPortfolioView(context, recommended, current, rebalance) {
  return {
    market: {
      panicLabel: context.panicLabel,
      strategyLabel: context.strategyLabel,
      cycleLabel: context.cycleLabel,
      marketLabel: context.marketLabel,
      ready: context.ready,
    },
    recommended,
    current,
    rebalance,
  }
}
