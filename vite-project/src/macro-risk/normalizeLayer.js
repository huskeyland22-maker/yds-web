/**
 * RAW → NORMALIZE 레이어.
 * 지표별 타입·단위를 자동 분류해 점수/트리거 계산 일관성 확보.
 */

/**
 * @typedef {'yield'|'index'|'volatility'|'spread'|'macro'} MetricType
 * @typedef {'absolute'|'percent'|'bps'|'index'} NormalizeMethod
 *
 * @typedef {Object} NormalizedMetric
 * @property {string} key
 * @property {MetricType} type
 * @property {NormalizeMethod} method
 * @property {number|null} current
 * @property {number|null} previous1D
 * @property {number|null} previous5D
 * @property {number|null} previous20D
 * @property {number|null} delta1D
 * @property {number|null} delta5D
 * @property {number|null} delta20D
 * @property {'up'|'down'|'flat'} slope
 */

/** @type {Record<string, { type: MetricType; method: NormalizeMethod }>} */
const METRIC_RULES = {
  US10Y: { type: "yield", method: "absolute" },
  REAL_YIELD: { type: "yield", method: "absolute" },
  DXY: { type: "index", method: "index" },
  MOVE: { type: "volatility", method: "index" },
  US30Y: { type: "yield", method: "absolute" },
  BEI: { type: "yield", method: "absolute" },
  VXN: { type: "volatility", method: "index" },
  US2Y: { type: "yield", method: "absolute" },
  CPI: { type: "macro", method: "percent" },
  CORE_CPI: { type: "macro", method: "percent" },
  PCE: { type: "macro", method: "percent" },
}

/**
 * @param {string} key
 * @returns {{ type: MetricType; method: NormalizeMethod }}
 */
export function classifyMetric(key) {
  return METRIC_RULES[key] ?? { type: "macro", method: "absolute" }
}

/**
 * @param {Record<string, import('./rawLayer.js').MetricSeries>} raw
 * @returns {Record<string, NormalizedMetric>}
 */
export function buildNormalizeLayer(raw) {
  /** @type {Record<string, NormalizedMetric>} */
  const out = {}
  for (const [key, s] of Object.entries(raw)) {
    const cls = classifyMetric(key)
    out[key] = {
      key,
      type: cls.type,
      method: cls.method,
      current: s.current ?? null,
      previous1D: s.previous1D ?? null,
      previous5D: s.previous5D ?? null,
      previous20D: s.previous20D ?? null,
      delta1D: s.change1D ?? null,
      delta5D: s.change5D ?? null,
      delta20D: s.change20D ?? null,
      slope: s.slope ?? "flat",
    }
  }
  return out
}
