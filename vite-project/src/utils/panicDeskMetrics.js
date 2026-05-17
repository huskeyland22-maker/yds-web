/** @typedef {{ key: string; label: string; chartLabel: string; accent: string; tooltip?: string }} PanicDeskMetric */

/** @type {PanicDeskMetric[]} */
export const CORE_METRICS = [
  { key: "vix", label: "VIX 변동성", chartLabel: "VIX", accent: "#f87171", tooltip: "S&P 500 내재 변동성" },
  { key: "fearGreed", label: "공포탐욕", chartLabel: "F&G", accent: "#fbbf24", tooltip: "시장 심리 종합 지수" },
  { key: "putCall", label: "풋콜비율", chartLabel: "P/C", accent: "#60a5fa", tooltip: "옵션 Put/Call 비율" },
  {
    key: "highYield",
    label: "하이일드 스프레드",
    chartLabel: "HY OAS",
    accent: "#fb923c",
    tooltip: "하이일드 채권 OAS 스프레드",
  },
]

/** @type {PanicDeskMetric[]} */
export const EXPERT_METRICS = [
  { key: "move", label: "MOVE 채권", chartLabel: "MOVE", accent: "#fbbf24", tooltip: "채권 변동성 지표" },
  { key: "skew", label: "SKEW 꼬리위험", chartLabel: "SKEW", accent: "#22d3ee", tooltip: "꼬리위험 지표" },
  { key: "bofa", label: "BofA 심리", chartLabel: "BofA", accent: "#c084fc", tooltip: "BofA Bull/Bear 심리" },
  {
    key: "gsBullBear",
    label: "GS 강세약세",
    chartLabel: "GS B/B",
    accent: "#a78bfa",
    tooltip: "Goldman Sachs 강세·약세 지표",
  },
  { key: "vxn", label: "VXN 나스닥", chartLabel: "VXN", accent: "#2dd4bf", tooltip: "나스닥 변동성 지수" },
]

/** @type {PanicDeskMetric[]} */
export const ALL_CHART_METRICS = [...CORE_METRICS, ...EXPERT_METRICS]

/** 패닉지수 히스토리 섹션 (8지표, VXN 제외) */
export const HISTORY_SECTION_METRICS = [
  { key: "vix", label: "VIX", chartLabel: "VIX", accent: "#f87171" },
  { key: "fearGreed", label: "CNN F&G", chartLabel: "F&G", accent: "#fbbf24" },
  { key: "bofa", label: "BofA", chartLabel: "BofA", accent: "#c084fc" },
  { key: "putCall", label: "P/C", chartLabel: "P/C", accent: "#60a5fa" },
  {
    key: "highYield",
    label: "HY OAS",
    chartLabel: "HY OAS",
    accent: "#fb923c",
  },
  { key: "move", label: "MOVE", chartLabel: "MOVE", accent: "#fbbf24" },
  { key: "skew", label: "SKEW", chartLabel: "SKEW", accent: "#22d3ee" },
  { key: "gsBullBear", label: "GS B/B", chartLabel: "GS B/B", accent: "#a78bfa" },
]

/** @param {string} key */
export function findChartMetric(key) {
  return ALL_CHART_METRICS.find((m) => m.key === key) ?? null
}
