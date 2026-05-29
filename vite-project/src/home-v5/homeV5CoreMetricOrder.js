/** @typedef {"fearGreed" | "vix" | "bofa"} HomeV5CoreMetricKey */

/** YDS 해석 순서: 위험(VIX) → 심리(CNN) → 신용(BofA) — 사이드바와 동일 */
export const HOME_V5_CORE_METRIC_ORDER = /** @type {readonly HomeV5CoreMetricKey[]} */ ([
  "vix",
  "fearGreed",
  "bofa",
])
