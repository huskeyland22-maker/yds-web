/**
 * SOXL limit-buy study v2 (research only).
 *
 * C and D are explicit research models, not a reconstruction of discretion.
 * selectedStrategy stays null. No rule is chosen from returns.
 *
 * Threshold policy, fixed before any strategy return is read:
 * - SMA length 50, drawdown window 20, and 5-session return window are
 *   declared here. They are not compared with other lengths.
 * - The only fitted numbers are the 25th percentiles of the 20-session
 *   close drawdown and the 5-session return, using sessions dated
 *   2022-09-30 or earlier. Quantile 0.25 is declared, not searched.
 * - Sessions from 2022-10-01 onward do not change those numbers and are
 *   not used to pick a condition.
 *
 * Fill assumptions match v1: base gap-at-open / touch-at-limit, and
 * conservative gap-at-limit-plus-10bp with touches unfilled.
 */

import {
  HORIZONS,
  SELECTED_STRATEGY,
  classifyFill,
  fillPrice,
  median,
  observationPath,
} from "./soxl-crash-buy-v1.mjs"

export { HORIZONS, SELECTED_STRATEGY, median }

export const TRAIN_END = "2022-09-30"
export const EVAL_START = "2022-10-01"
export const SMA_PERIOD = 50
export const DRAWDOWN_WINDOW = 20
export const RETURN_WINDOW = 5
export const DRAWDOWN_QUANTILE = 0.25
export const RETURN_QUANTILE = 0.25
export const LIMIT_OFF = 0.9
export const LIMIT_DEEP = 0.85

function round4(value) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 10000) / 10000
}

function mean(values) {
  const xs = values.filter((value) => Number.isFinite(value))
  if (!xs.length) return null
  return xs.reduce((sum, value) => sum + value, 0) / xs.length
}

/**
 * Nearest-rank quantile. Index = floor(q * (n - 1)) on the sorted sample.
 * @param {number[]} values
 * @param {number} q
 */
export function quantile(values, q) {
  const xs = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  if (!xs.length) return null
  const index = Math.floor(q * (xs.length - 1))
  return xs[index]
}

export function smaAt(values, index, period) {
  if (index < period - 1) return null
  let sum = 0
  for (let i = index - period + 1; i <= index; i++) {
    if (!Number.isFinite(values[i])) return null
    sum += values[i]
  }
  return sum / period
}

/** Close divided by the max close in the window ending at index, minus 1. */
export function drawdownAt(values, index, window) {
  if (index < window - 1) return null
  let high = -Infinity
  for (let i = index - window + 1; i <= index; i++) {
    if (!Number.isFinite(values[i]) || values[i] <= 0) return null
    if (values[i] > high) high = values[i]
  }
  return values[index] / high - 1
}

export function returnAt(values, index, window) {
  if (index < window) return null
  const prev = values[index - window]
  if (!Number.isFinite(prev) || prev <= 0 || !Number.isFinite(values[index])) return null
  return values[index] / prev - 1
}

/**
 * Inner join on date. SOXL OHLC is the traded series. SMH contributes its close.
 * @param {{ date: string, open: number, high: number, low: number, close: number, volume?: number }[]} soxl
 * @param {{ date: string, close: number }[]} smh
 */
export function alignSoXlSmh(soxl, smh) {
  const smhClose = new Map()
  for (const bar of smh || []) {
    if (bar?.date && Number.isFinite(bar.close) && bar.close > 0) smhClose.set(bar.date, bar.close)
  }
  return (soxl || [])
    .filter((bar) => bar?.date && smhClose.has(bar.date) && bar.open > 0 && bar.high > 0 && bar.low > 0 && bar.close > 0)
    .map((bar) => ({
      date: bar.date,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume ?? 0,
      smhClose: smhClose.get(bar.date),
    }))
}

/**
 * Percentiles from sessions on or before TRAIN_END only.
 * @param {{ date: string, close: number }[]} rows
 */
export function freezeThresholds(rows) {
  const closes = rows.map((row) => row.close)
  /** @type {number[]} */
  const drawdowns = []
  /** @type {number[]} */
  const returns = []
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].date > TRAIN_END) continue
    const drawdown = drawdownAt(closes, i, DRAWDOWN_WINDOW)
    const ret = returnAt(closes, i, RETURN_WINDOW)
    if (drawdown != null) drawdowns.push(drawdown)
    if (ret != null) returns.push(ret)
  }
  return {
    trainEnd: TRAIN_END,
    evalStart: EVAL_START,
    smaPeriod: SMA_PERIOD,
    drawdownWindow: DRAWDOWN_WINDOW,
    returnWindow: RETURN_WINDOW,
    drawdownQuantile: DRAWDOWN_QUANTILE,
    returnQuantile: RETURN_QUANTILE,
    drawdownMax: quantile(drawdowns, DRAWDOWN_QUANTILE),
    return5Max: quantile(returns, RETURN_QUANTILE),
    trainDrawdownN: drawdowns.length,
    trainReturnN: returns.length,
    selectedByReturn: false,
  }
}

/**
 * Flags at index i use closes through i only.
 * @param {{ date: string, close: number, smhClose: number }[]} rows
 * @param {{ drawdownMax: number, return5Max: number }} thresholds
 */
export function buildFlags(rows, thresholds) {
  const soxl = rows.map((row) => row.close)
  const smh = rows.map((row) => row.smhClose)
  return rows.map((row, index) => {
    const soxlSma = smaAt(soxl, index, SMA_PERIOD)
    const smhSma = smaAt(smh, index, SMA_PERIOD)
    const drawdown = drawdownAt(soxl, index, DRAWDOWN_WINDOW)
    const return5 = returnAt(soxl, index, RETURN_WINDOW)
    const ready = soxlSma != null && smhSma != null && drawdown != null && return5 != null
    const deterioration =
      ready &&
      row.close < soxlSma &&
      row.smhClose < smhSma &&
      drawdown <= thresholds.drawdownMax
    const anticipation = ready && return5 <= thresholds.return5Max
    return {
      date: row.date,
      index,
      ready,
      deterioration,
      anticipation,
    }
  })
}

/**
 * C orders every ready session. D orders only when anticipation is true.
 * Deterioration replaces a -10% order with -15% before the next session.
 * @param {{ date: string, open: number, high: number, low: number, close: number }[]} rows
 * @param {object[]} flags
 * @param {"C" | "D"} strategy
 * @param {"base" | "conservative"} mode
 */
export function buildResearchOrders(rows, flags, strategy, mode) {
  /** @type {object[]} */
  const orders = []
  for (let i = 0; i < rows.length - 1; i++) {
    const flag = flags[i]
    if (!flag?.ready) continue
    let factor = null
    if (strategy === "C") factor = flag.deterioration ? LIMIT_DEEP : LIMIT_OFF
    else if (strategy === "D") {
      if (!flag.anticipation) continue
      factor = flag.deterioration ? LIMIT_DEEP : LIMIT_OFF
    } else continue
    const next = rows[i + 1]
    const limit = rows[i].close * factor
    const kind = classifyFill(next, limit)
    const price = fillPrice(mode, kind, next, limit)
    orders.push({
      decisionDate: rows[i].date,
      sessionDate: next.date,
      decisionIndex: i,
      sessionIndex: i + 1,
      factor,
      deterioration: flag.deterioration,
      anticipation: flag.anticipation,
      limit,
      kind,
      filled: price != null,
      fillPrice: price,
    })
  }
  return orders
}

function inRange(order, range) {
  if (!range) return true
  if (range.start && order.decisionDate < range.start) return false
  if (range.end && order.decisionDate > range.end) return false
  return true
}

function horizonReturn(rows, order, horizon, lastIndex) {
  const idx = order.sessionIndex + horizon
  if (!order.filled || idx > lastIndex || idx >= rows.length || !(order.fillPrice > 0)) return null
  return rows[idx].close / order.fillPrice - 1
}

function maeToHorizon(rows, order, horizon, lastIndex) {
  const end = order.sessionIndex + horizon
  if (!order.filled || end > lastIndex || end >= rows.length || !(order.fillPrice > 0)) return null
  let minLow = Infinity
  for (let i = order.sessionIndex; i <= end; i++) {
    if (rows[i].low < minLow) minLow = rows[i].low
  }
  return minLow / order.fillPrice - 1
}

function recoveryDays(rows, order, lastIndex) {
  if (!order.filled || !(order.fillPrice > 0)) return { recovered: false, days: null }
  const end = Math.min(lastIndex, rows.length - 1)
  for (let i = order.sessionIndex; i <= end; i++) {
    if (rows[i].close >= order.fillPrice) return { recovered: true, days: i - order.sessionIndex }
  }
  return { recovered: false, days: null }
}

function returnStats(values) {
  const xs = values.filter((value) => Number.isFinite(value))
  return {
    n: xs.length,
    mean: round4(mean(xs)),
    median: round4(median(xs)),
    winRate: xs.length ? round4(xs.filter((value) => value > 0).length / xs.length) : null,
  }
}

/**
 * @param {object[]} rows
 * @param {object[]} orders
 * @param {{ start?: string | null, end?: string | null, lastIndex?: number }} [range]
 */
export function summarizeResearchOrders(rows, orders, range = {}) {
  const lastIndex = range.lastIndex ?? rows.length - 1
  const selected = orders.filter((order) => inRange(order, range) && order.sessionIndex <= lastIndex)
  const filled = selected.filter((order) => order.filled)
  const horizons = {}
  for (const horizon of HORIZONS) {
    const returns = filled.map((order) => horizonReturn(rows, order, horizon, lastIndex)).filter((value) => value != null)
    const maes = filled.map((order) => maeToHorizon(rows, order, horizon, lastIndex)).filter((value) => value != null)
    horizons[String(horizon)] = {
      ...returnStats(returns),
      mae: { n: maes.length, mean: round4(mean(maes)), median: round4(median(maes)) },
    }
  }
  const recoveries = filled.map((order) => recoveryDays(rows, order, lastIndex))
  const recoveredDays = recoveries.filter((row) => row.recovered).map((row) => row.days)
  const startIndex = selected.length ? Math.min(...selected.map((order) => order.decisionIndex)) : 0
  const sliced = rows.slice(startIndex, lastIndex + 1)
  const remapped = selected.map((order) => ({
    ...order,
    sessionIndex: order.sessionIndex - startIndex,
  }))
  const paths = {}
  for (const horizon of HORIZONS) paths[String(horizon)] = observationPath(remapped, sliced, horizon)
  return {
    orders: selected.length,
    deepOrders: selected.filter((order) => order.factor === LIMIT_DEEP).length,
    shallowOrders: selected.filter((order) => order.factor === LIMIT_OFF).length,
    filled: filled.length,
    unfilled: selected.length - filled.length,
    fillRate: selected.length ? round4(filled.length / selected.length) : null,
    unfilledRate: selected.length ? round4((selected.length - filled.length) / selected.length) : null,
    gapCandidates: selected.filter((order) => order.kind === "gap").length,
    touchCandidates: selected.filter((order) => order.kind === "touch").length,
    gapsFilled: filled.filter((order) => order.kind === "gap").length,
    touchesFilled: filled.filter((order) => order.kind === "touch").length,
    horizons,
    recovery: {
      recovered: recoveredDays.length,
      unrecovered: recoveries.filter((row) => !row.recovered).length,
      meanDays: round4(mean(recoveredDays)),
      medianDays: round4(median(recoveredDays)),
    },
    paths,
  }
}

/**
 * Constant-factor A/B orders on the same rows, for a side-by-side description.
 * @param {object[]} rows
 * @param {number} factor
 * @param {"base" | "conservative"} mode
 * @param {object[]} flags
 */
export function buildFixedOrders(rows, flags, factor, mode) {
  /** @type {object[]} */
  const orders = []
  for (let i = 0; i < rows.length - 1; i++) {
    if (!flags[i]?.ready) continue
    const next = rows[i + 1]
    const limit = rows[i].close * factor
    const kind = classifyFill(next, limit)
    const price = fillPrice(mode, kind, next, limit)
    orders.push({
      decisionDate: rows[i].date,
      sessionDate: next.date,
      decisionIndex: i,
      sessionIndex: i + 1,
      factor,
      limit,
      kind,
      filled: price != null,
      fillPrice: price,
    })
  }
  return orders
}

export function indexOnOrBefore(rows, date) {
  let index = -1
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].date <= date) index = i
  }
  return index
}
