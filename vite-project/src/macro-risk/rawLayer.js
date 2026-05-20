import { absDelta, lastFinite, slopeDirection, valueAtOffset } from "./seriesMath.js"
import { MACRO_RISK_SEED_HISTORY } from "./staticSeed.js"

/**
 * @typedef {Object} MetricSeries
 * @property {number|null} current
 * @property {number|null} change1D
 * @property {number|null} change5D
 * @property {number|null} change20D
 * @property {'up'|'down'|'flat'} slope
 * @property {string} status
 * @property {number|null} [previous1D]
 * @property {number|null} [previous5D]
 * @property {number|null} [previous20D]
 */

/**
 * @param {string} key
 * @param {number[]} history
 * @param {{ mode?: 'rate'|'index' }} [opts]
 * @returns {MetricSeries}
 */
export function buildMetricSeries(key, history, opts = {}) {
  const values = Array.isArray(history) ? history.map(Number).filter((v) => Number.isFinite(v)) : []
  const current = lastFinite(values)
  const prev1 = valueAtOffset(values, 1)
  const prev5 = valueAtOffset(values, 5)
  const prev20 = valueAtOffset(values, 20)
  const slope = slopeDirection(values)

  const change1D = absDelta(prev1, current)
  const change5D = absDelta(prev5, current)
  const change20D = absDelta(prev20, current)

  let status = "보합"
  if (opts.mode === "rate") {
    if (change20D != null && change20D > 0.2) status = "장기 상승 압력"
    else if (change5D != null && change5D > 0.1) status = "단기 상승"
    else if (slope === "down") status = "완화"
  } else if (slope === "up") status = "상승 추세"
  else if (slope === "down") status = "하락 추세"

  return {
    key,
    current,
    previous1D: prev1,
    previous5D: prev5,
    previous20D: prev20,
    change1D,
    change5D,
    change20D,
    slope,
    status,
  }
}

/**
 * @param {Record<string, number[]>} apiHistory
 * @returns {Record<string, MetricSeries>}
 */
export function buildRawLayer(apiHistory = {}) {
  const rateKeys = ["US10Y", "US30Y", "US2Y", "REAL_YIELD", "MOVE"]
  const inflKeys = ["BEI", "CPI", "CORE_CPI", "PCE"]
  const liqKeys = ["DXY", "QT", "M2", "FED_BALANCE"]

  /** @type {Record<string, MetricSeries>} */
  const out = {}

  const allKeys = [...rateKeys, ...inflKeys, ...liqKeys]
  for (const key of allKeys) {
    const hist = apiHistory[key] ?? MACRO_RISK_SEED_HISTORY[key] ?? []
    const mode = rateKeys.includes(key) || key === "REAL_YIELD" || key === "BEI" ? "rate" : "index"
    out[key] = buildMetricSeries(key, hist, { mode })
  }

  return out
}
