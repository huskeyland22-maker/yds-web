/**
 * YDS 패닉 8지표 체계
 * VIX · VXN · CNN · PutCall · BofA · MOVE · SKEW · HY OAS
 */

/** @type {readonly string[]} */
export const PANIC_METRIC_KEYS = Object.freeze([
  "vix",
  "vxn",
  "fearGreed",
  "putCall",
  "bofa",
  "move",
  "skew",
  "highYield",
])

/** @type {{ key: string; label: string }[]} */
export const PANIC_METRIC_DEFS = Object.freeze([
  { key: "vix", label: "VIX" },
  { key: "vxn", label: "VXN" },
  { key: "fearGreed", label: "Fear & Greed" },
  { key: "putCall", label: "Put/Call" },
  { key: "bofa", label: "BofA" },
  { key: "move", label: "MOVE" },
  { key: "skew", label: "SKEW" },
  { key: "highYield", label: "High Yield" },
])

/** @deprecated use PANIC_METRIC_KEYS */
export const PANIC_NINE_KEYS = PANIC_METRIC_DEFS
