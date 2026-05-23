import { piecewiseNorm } from "./piecewise.js"

/** @type {Record<string, [number, number][]>} */
export const PANIC_V2_KNOTS = {
  vix: [
    [10, 0],
    [20, 30],
    [30, 60],
    [40, 100],
  ],
  highYield: [
    [2, 0],
    [4, 50],
    [6, 100],
  ],
  move: [
    [60, 0],
    [100, 50],
    [140, 100],
  ],
  vxn: [
    [15, 0],
    [25, 30],
    [35, 60],
    [50, 100],
  ],
  putCall: [
    [0.55, 0],
    [0.7, 30],
    [0.85, 60],
    [1.1, 100],
  ],
  fearGreed: [
    [80, 0],
    [60, 30],
    [40, 60],
    [15, 100],
  ],
  skew: [
    [118, 0],
    [130, 30],
    [140, 60],
    [155, 100],
  ],
  bofa: [
    [8, 0],
    [6, 25],
    [4, 50],
    [2, 80],
    [0, 100],
  ],
  gsBullBear: [
    [70, 0],
    [50, 30],
    [35, 60],
    [20, 100],
  ],
}

/** @param {string} key @param {number | null | undefined} raw */
export function normalizePanicV2Metric(key, raw) {
  const knots = PANIC_V2_KNOTS[key]
  if (!knots) return null
  return piecewiseNorm(raw, knots)
}
