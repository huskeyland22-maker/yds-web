import { piecewiseNorm } from "./piecewise.js"

/** 패닉 V2 실전 엔진 — piecewise knots (0~100 공포 점수) */
export const PANIC_V2_KNOTS = {
  vix: [
    [12, 0],
    [18, 25],
    [25, 50],
    [35, 75],
    [45, 100],
  ],
  vvix: [
    [90, 0],
    [105, 30],
    [120, 55],
    [140, 80],
    [165, 100],
  ],
  /** front/back - 1 (%). 백워데이션(front>back)일수록 높음 */
  vixTerm: [
    [-6, 0],
    [-1, 20],
    [0, 40],
    [5, 70],
    [12, 100],
  ],
  putCall: [
    [0.55, 0],
    [0.7, 30],
    [0.85, 55],
    [1.0, 80],
    [1.15, 100],
  ],
  /** (price - MA20) / MA20 % — 음수일수록 눌림·반등 후보 */
  ndxDistance: [
    [-12, 100],
    [-8, 80],
    [-5, 55],
    [-2, 30],
    [0, 10],
    [5, 0],
  ],
  soxxDistance: [
    [-12, 100],
    [-8, 80],
    [-5, 55],
    [-2, 30],
    [0, 10],
    [5, 0],
  ],
  dxy: [
    [98, 0],
    [102, 30],
    [105, 55],
    [108, 80],
    [112, 100],
  ],
  move: [
    [60, 0],
    [100, 45],
    [130, 75],
    [160, 100],
  ],
}

/** @param {string} key @param {number | null | undefined} raw */
export function normalizePanicV2Metric(key, raw) {
  const knots = PANIC_V2_KNOTS[key]
  if (!knots) return null
  return piecewiseNorm(raw, knots)
}
