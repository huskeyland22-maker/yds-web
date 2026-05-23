/**
 * 패닉 V2 실전 동적 히스토리 가중치 (합 1.0)
 */
export const PANIC_V2_DYNAMIC_WEIGHTS = {
  vix: 0.15,
  vvix: 0.1,
  vixTerm: 0.15,
  putCall: 0.2,
  ndxDistance: 0.15,
  soxxDistance: 0.1,
  dxy: 0.1,
  move: 0.05,
}

/** @type {string[]} */
export const PANIC_V2_DYNAMIC_METRIC_KEYS = Object.keys(PANIC_V2_DYNAMIC_WEIGHTS)

export const PANIC_V2_DYNAMIC_WEIGHT_SUM = Object.values(PANIC_V2_DYNAMIC_WEIGHTS).reduce(
  (a, b) => a + b,
  0,
)
