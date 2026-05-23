/**
 * 패닉 V2 실전 엔진 가중치 (합 100)
 * 변동성 40 · 심리 20 · 추세 25 · 유동성 15
 */

/** @typedef {"volatility" | "psychology" | "trend" | "liquidity"} PanicV2Group */

/**
 * @typedef {{
 *   key: string
 *   label: string
 *   shortLabel: string
 *   weight: number
 *   group: PanicV2Group
 * }} PanicV2MetricDef
 */

/** @type {PanicV2MetricDef[]} */
export const PANIC_V2_METRICS = [
  { key: "vix", label: "VIX", shortLabel: "VIX", weight: 15, group: "volatility" },
  { key: "vvix", label: "VVIX", shortLabel: "VVIX", weight: 10, group: "volatility" },
  { key: "vixTerm", label: "VIX Term", shortLabel: "TERM", weight: 15, group: "volatility" },
  { key: "putCall", label: "P/C Ratio", shortLabel: "P/C", weight: 20, group: "psychology" },
  { key: "ndxDistance", label: "NDX 이격", shortLabel: "NDX", weight: 15, group: "trend" },
  { key: "soxxDistance", label: "SOXX 이격", shortLabel: "SOXX", weight: 10, group: "trend" },
  { key: "dxy", label: "DXY", shortLabel: "DXY", weight: 10, group: "liquidity" },
  { key: "move", label: "MOVE", shortLabel: "MOVE", weight: 5, group: "liquidity" },
]

export const PANIC_V2_VOL_WEIGHT_SUM = PANIC_V2_METRICS.filter((m) => m.group === "volatility").reduce(
  (s, m) => s + m.weight,
  0,
)

export const PANIC_V2_TREND_WEIGHT_SUM = PANIC_V2_METRICS.filter((m) => m.group === "trend").reduce(
  (s, m) => s + m.weight,
  0,
)

/** @deprecated PanicCoreMetricsBlock 호환 */
export const PANIC_V2_CORE_WEIGHT_SUM = PANIC_V2_VOL_WEIGHT_SUM + 20

/** @deprecated */
export const PANIC_V2_EXPERT_WEIGHT_SUM = PANIC_V2_TREND_WEIGHT_SUM + 15

/** 차트 하단 — V2 보조 시리즈 (레이아웃 변경 없음) */
export const PANIC_V2_CHART_DETAIL_METRICS = [
  { key: "vix", label: "VIX", chartLabel: "VIX", accent: "#f87171" },
  { key: "vvix", label: "VVIX", chartLabel: "VVIX", accent: "#fb7185" },
  { key: "ndxDistance", label: "NDX", chartLabel: "NDX 이격%", accent: "#38bdf8" },
  { key: "soxxDistance", label: "SOXX", chartLabel: "SOXX 이격%", accent: "#a78bfa" },
]
