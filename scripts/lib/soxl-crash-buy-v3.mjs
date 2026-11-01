/**
 * SOXL limit-buy sensitivity study v3 (research only).
 *
 * Does not retune v2 thresholds or rules. selectedStrategy stays null.
 * Extra fill scenarios are sensitivity cases, not estimates of the
 * probability that a touch would have filled.
 * No sell rule is added. A holding mark is not realized performance.
 */

import { LIMIT_FACTORS, SELECTED_STRATEGY } from "./soxl-crash-buy-v1.mjs"
import {
  EVAL_START,
  TRAIN_END,
  buildFixedOrders,
  buildResearchOrders,
  indexOnOrBefore,
  summarizeResearchOrders,
} from "./soxl-crash-buy-v2.mjs"

export { SELECTED_STRATEGY, TRAIN_END, EVAL_START }

export const MIN_COMPARISON_N = 10
export const INITIAL_CASH = 1
export const MAX_POSITIONS = 1
export const ACCOUNTING_HORIZON = 20

/** Declared before results. Not a searched fill probability. */
export const FILL_SCENARIOS = Object.freeze([
  Object.freeze({ id: "base", touch: "all", gapPrice: "open" }),
  Object.freeze({ id: "close-through", touch: "close-at-or-below-limit", gapPrice: "open" }),
  Object.freeze({ id: "gap-only-open", touch: "none", gapPrice: "open" }),
  Object.freeze({ id: "conservative", touch: "none", gapPrice: "limit-plus-10bp" }),
])

export const PERIODS = Object.freeze([
  Object.freeze({ id: "eval", start: "2022-10-01", end: "2026-09-30", censorAtEnd: false }),
  Object.freeze({ id: "y2022_2024", start: "2022-10-01", end: "2024-12-31", censorAtEnd: true }),
  Object.freeze({ id: "y2025_2026", start: "2025-01-01", end: "2026-09-30", censorAtEnd: true }),
])

function round4(value) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 10000) / 10000
}

/**
 * @param {{ open: number, close: number } | null | undefined} session
 * @param {{ kind: string, limit: number }} order
 * @param {{ touch: string, gapPrice: string }} scenario
 */
export function scenarioFillPrice(session, order, scenario) {
  if (!session || !order || order.kind === "unfilled") return null
  if (order.kind === "gap") {
    if (scenario.gapPrice === "open") return session.open
    if (scenario.gapPrice === "limit-plus-10bp") return order.limit * (1 + 0.001)
    return null
  }
  if (order.kind === "touch") {
    if (scenario.touch === "all") return order.limit
    if (scenario.touch === "close-at-or-below-limit" && session.close <= order.limit) return order.limit
    return null
  }
  return null
}

/**
 * @param {object[]} rows
 * @param {object[]} orders classified by the v2 base fill kind
 * @param {{ touch: string, gapPrice: string }} scenario
 */
export function applyScenario(rows, orders, scenario) {
  return orders.map((order) => {
    const price = scenarioFillPrice(rows[order.sessionIndex], order, scenario)
    return { ...order, filled: price != null && price > 0, fillPrice: price }
  })
}

export function duplicateSessionIndexes(orders) {
  const seen = new Set()
  /** @type {number[]} */
  const duplicates = []
  for (const order of orders) {
    if (seen.has(order.sessionIndex)) duplicates.push(order.sessionIndex)
    seen.add(order.sessionIndex)
  }
  return duplicates
}

function markSmallSample(summary) {
  const horizons = {}
  for (const [key, row] of Object.entries(summary.horizons)) {
    horizons[key] = { ...row, comparisonDeferred: row.n < MIN_COMPARISON_N }
  }
  return {
    ...summary,
    horizons,
    anyComparisonDeferred: Object.values(horizons).some((row) => row.comparisonDeferred),
  }
}

/**
 * @param {object[]} rows
 * @param {object[]} orders
 * @param {{ start: string, end: string, censorAtEnd: boolean }} period
 */
export function summarizePeriod(rows, orders, period) {
  const lastIndex = period.censorAtEnd ? indexOnOrBefore(rows, period.end) : rows.length - 1
  return markSmallSample(
    summarizeResearchOrders(rows, orders, {
      start: period.start,
      end: period.end,
      lastIndex,
    }),
  )
}

function windowBounds(rows, range) {
  let startIndex = -1
  let lastIndex = -1
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].date >= range.start && startIndex < 0) startIndex = i
    if (rows[i].date <= range.end) lastIndex = i
  }
  return { startIndex, lastIndex }
}

/**
 * One position, all free cash, no sale. Later signals cannot buy.
 * Final equity is a mark. Realized performance is null.
 * @param {object[]} rows
 * @param {object[]} orders
 * @param {{ start: string, end: string }} range
 */
export function holdingAccount(rows, orders, range) {
  const { startIndex, lastIndex } = windowBounds(rows, range)
  if (startIndex < 0 || lastIndex < startIndex) {
    return emptyAccount("holding-mark")
  }
  const candidates = orders
    .filter(
      (order) =>
        order.filled &&
        order.decisionDate >= range.start &&
        order.decisionDate <= range.end &&
        order.sessionIndex >= startIndex &&
        order.sessionIndex <= lastIndex,
    )
    .sort((a, b) => a.sessionIndex - b.sessionIndex)
  if (duplicateSessionIndexes(candidates).length) throw new Error("duplicate session in holding account")

  let cash = INITIAL_CASH
  let shares = 0
  let fills = 0
  let peak = INITIAL_CASH
  let maxDrawdown = 0
  let investedDays = 0
  let days = 0
  let minCash = cash
  const bySession = new Map(candidates.map((order) => [order.sessionIndex, order]))

  for (let i = startIndex; i <= lastIndex; i++) {
    const order = bySession.get(i)
    if (order && shares === 0 && fills < MAX_POSITIONS && cash > 0) {
      shares = cash / order.fillPrice
      cash = 0
      fills += 1
    }
    if (cash < minCash) minCash = cash
    const equity = cash + shares * rows[i].close
    if (equity > peak) peak = equity
    const dd = equity / peak - 1
    if (dd < maxDrawdown) maxDrawdown = dd
    days += 1
    if (shares > 0) investedDays += 1
  }
  const finalEquity = cash + shares * rows[lastIndex].close
  return accountResult("holding-mark", finalEquity, maxDrawdown, cash, minCash, investedDays, days, fills, null)
}

/**
 * Cash is reassigned at the horizon close so a later order can be funded.
 * That reassignment is an accounting device, not a sell and not realized performance.
 * @param {object[]} rows
 * @param {object[]} orders
 * @param {{ start: string, end: string }} range
 * @param {number} [horizon]
 */
export function horizonAccount(rows, orders, range, horizon = ACCOUNTING_HORIZON) {
  const { startIndex, lastIndex } = windowBounds(rows, range)
  if (startIndex < 0 || lastIndex < startIndex) return emptyAccount("horizon-accounting")
  const bySession = new Map()
  for (const order of orders) {
    if (!order.filled || order.decisionDate < range.start || order.decisionDate > range.end) continue
    if (order.sessionIndex < startIndex || order.sessionIndex > lastIndex) continue
    if (bySession.has(order.sessionIndex)) throw new Error("duplicate session in horizon account")
    bySession.set(order.sessionIndex, order)
  }

  let cash = INITIAL_CASH
  let shares = 0
  let lockUntil = -1
  let fills = 0
  let peak = INITIAL_CASH
  let maxDrawdown = 0
  let investedDays = 0
  let days = 0
  let minCash = cash

  for (let i = startIndex; i <= lastIndex; i++) {
    const wasLocked = shares > 0 && i <= lockUntil
    if (shares > 0 && i === lockUntil && lockUntil <= lastIndex) {
      cash = shares * rows[i].close
      shares = 0
      lockUntil = -1
    }
    const order = bySession.get(i)
    const openPositions = shares > 0 ? 1 : 0
    if (!wasLocked && order && openPositions < MAX_POSITIONS && cash > 0) {
      shares = cash / order.fillPrice
      cash = 0
      lockUntil = i + horizon
      fills += 1
    }
    if (cash < minCash) minCash = cash
    const equity = cash + shares * rows[i].close
    if (equity > peak) peak = equity
    const dd = equity / peak - 1
    if (dd < maxDrawdown) maxDrawdown = dd
    days += 1
    if (shares > 0) investedDays += 1
  }
  const finalEquity = cash + shares * rows[lastIndex].close
  return accountResult("horizon-accounting", finalEquity, maxDrawdown, cash, minCash, investedDays, days, fills, horizon)
}

function emptyAccount(kind) {
  return accountResult(kind, INITIAL_CASH, 0, INITIAL_CASH, INITIAL_CASH, 0, 0, 0, null)
}

function accountResult(kind, finalEquity, maxDrawdown, cash, minCash, investedDays, days, fills, horizon) {
  return {
    kind,
    realized: null,
    initialCash: INITIAL_CASH,
    maxPositions: MAX_POSITIONS,
    horizon,
    finalEquity: round4(finalEquity),
    maxDrawdown: round4(maxDrawdown),
    endingCashWeight: finalEquity > 0 ? round4(cash / finalEquity) : null,
    utilization: days ? round4(investedDays / days) : null,
    fills,
    minCash: round4(minCash),
    cashNeverNegative: minCash >= -1e-9,
  }
}

/**
 * @param {object} actual
 * @param {object} expected
 */
export function regressionMismatches(actual, expected) {
  /** @type {{ path: string, actual: unknown, expected: unknown }[]} */
  const misses = []
  const check = (path, left, right) => {
    if (left !== right) misses.push({ path, actual: left, expected: right })
  }
  check("orders", actual.orders, expected.orders)
  check("filled", actual.filled, expected.filled)
  check("fillRate", actual.fillRate, expected.fillRate)
  check("gapCandidates", actual.gapCandidates, expected.gapCandidates)
  check("touchCandidates", actual.touchCandidates, expected.touchCandidates)
  for (const horizon of ["5", "20", "60"]) {
    check(`${horizon}.n`, actual.horizons[horizon].n, expected.horizons[horizon].n)
    check(`${horizon}.mean`, actual.horizons[horizon].mean, expected.horizons[horizon].mean)
  }
  return misses
}

/**
 * @param {object[]} rows
 * @param {object[]} flags
 */
export function strategyOrders(rows, flags) {
  return {
    C: buildResearchOrders(rows, flags, "C", "base"),
    D: buildResearchOrders(rows, flags, "D", "base"),
    A: buildFixedOrders(rows, flags, LIMIT_FACTORS.A, "base"),
    B: buildFixedOrders(rows, flags, LIMIT_FACTORS.B, "base"),
  }
}
