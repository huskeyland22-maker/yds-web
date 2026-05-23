/**
 * 패닉 V2 동적 히스토리 가중치 (합 1.0)
 */
export const PANIC_V2_DYNAMIC_WEIGHTS = {
  vix: 0.22,
  vxn: 0.15,
  putCall: 0.18,
  fearGreed: 0.12,
  highYield: 0.12,
  move: 0.08,
  skew: 0.05,
  gsBullBear: 0.04,
  bofa: 0.04,
}

/** @type {string[]} */
export const PANIC_V2_DYNAMIC_METRIC_KEYS = Object.keys(PANIC_V2_DYNAMIC_WEIGHTS)

export const PANIC_V2_DYNAMIC_WEIGHT_SUM = Object.values(PANIC_V2_DYNAMIC_WEIGHTS).reduce(
  (a, b) => a + b,
  0,
)
