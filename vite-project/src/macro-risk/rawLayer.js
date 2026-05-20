import { absDelta, lastFinite, slopeDirection, valueAtOffset } from "./seriesMath.js"

/**
 * @typedef {Object} MetricSeries
 * @property {number|null} current
 * @property {number|null} change1D
 * @property {number|null} change5D
 * @property {number|null} change20D
 * @property {'up'|'down'|'flat'} slope
 * @property {string} status
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
    change1D,
    change5D,
    change20D,
    slope,
    status,
  }
}

/** 데모·후행 지표 — API 미연동 시 변화율 시뮬레이션 (패닉 데이터 비침투) */
const SEED_HISTORY = {
  US2Y: [4.55, 4.58, 4.6, 4.62, 4.64, 4.66, 4.68, 4.7, 4.72, 4.74, 4.76, 4.78, 4.8, 4.82, 4.84, 4.86, 4.88, 4.9, 4.92, 4.94, 4.96, 4.98],
  REAL_YIELD: [1.82, 1.84, 1.85, 1.86, 1.87, 1.88, 1.89, 1.9, 1.91, 1.92, 1.93, 1.94, 1.95, 1.96, 1.97, 1.98, 1.99, 2.0, 2.01, 2.02, 2.03, 2.05],
  BEI: [2.28, 2.29, 2.3, 2.31, 2.32, 2.33, 2.34, 2.35, 2.36, 2.37, 2.38, 2.39, 2.4, 2.41, 2.42, 2.43, 2.44, 2.45, 2.46, 2.47, 2.48, 2.5],
  CPI: [3.1, 3.08, 3.06, 3.05, 3.04, 3.03, 3.02, 3.01, 3.0, 2.99, 2.98, 2.97, 2.96, 2.95, 2.94, 2.93, 2.92, 2.91, 2.9, 2.89, 2.88, 2.87],
  CORE_CPI: [3.4, 3.38, 3.36, 3.35, 3.34, 3.33, 3.32, 3.31, 3.3, 3.29, 3.28, 3.27, 3.26, 3.25, 3.24, 3.23, 3.22, 3.21, 3.2, 3.19, 3.18, 3.17],
  PCE: [2.6, 2.59, 2.58, 2.57, 2.56, 2.55, 2.54, 2.53, 2.52, 2.51, 2.5, 2.49, 2.48, 2.47, 2.46, 2.45, 2.44, 2.43, 2.42, 2.41, 2.4, 2.38],
  QT: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  M2: [100, 99.8, 99.6, 99.5, 99.3, 99.1, 98.9, 98.7, 98.5, 98.3, 98.1, 97.9, 97.7, 97.5, 97.3, 97.1, 96.9, 96.7, 96.5, 96.3, 96.1, 95.9],
  FED_BALANCE: [100, 99.5, 99, 98.5, 98, 97.5, 97, 96.5, 96, 95.5, 95, 94.5, 94, 93.5, 93, 92.5, 92, 91.5, 91, 90.5, 90, 89.5],
}

/**
 * @param {Record<string, number[]>} apiHistory
 * @returns {Record<string, MetricSeries>}
 */
export function buildRawLayer(apiHistory = {}) {
  const rateKeys = ["US10Y", "US2Y", "REAL_YIELD", "MOVE"]
  const inflKeys = ["BEI", "CPI", "CORE_CPI", "PCE"]
  const liqKeys = ["DXY", "QT", "M2", "FED_BALANCE"]

  /** @type {Record<string, MetricSeries>} */
  const out = {}

  const allKeys = [...rateKeys, ...inflKeys, ...liqKeys]
  for (const key of allKeys) {
    const hist = apiHistory[key] ?? SEED_HISTORY[key] ?? []
    const mode = rateKeys.includes(key) || key === "REAL_YIELD" || key === "BEI" ? "rate" : "index"
    out[key] = buildMetricSeries(key, hist, { mode })
  }

  return out
}
