/** @typedef {{ key: string; label: string; chartLabel: string; accent: string; tooltip?: string; badge?: string }} PanicDeskMetric */

/** @type {PanicDeskMetric[]} */
export const CORE_METRICS = [
  { key: "vix", label: "VIX 변동성", chartLabel: "VIX", accent: "#f87171", tooltip: "S&P 500 내재 변동성" },
  { key: "fearGreed", label: "공포탐욕", chartLabel: "F&G", accent: "#fbbf24", tooltip: "시장 심리 종합 지수" },
  { key: "putCall", label: "풋콜비율", chartLabel: "P/C", accent: "#60a5fa", tooltip: "옵션 Put/Call 비율" },
  {
    key: "highYield",
    label: "하이일드",
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
  { key: "vxn", label: "VXN 나스닥", chartLabel: "VXN", accent: "#2dd4bf", tooltip: "나스닥 변동성 지수" },
]

/** @type {PanicDeskMetric[]} */
export const ALL_CHART_METRICS = [...CORE_METRICS, ...EXPERT_METRICS]

/** 패닉지수 히스토리 — 8대 원본 지표 (4+4 선택) */
export const PANIC_INDEX_HISTORY_ROWS = [
  [
    { key: "vix", shortLabel: "VIX", chartLabel: "VIX", accent: "#f87171", tooltip: "VIX 변동성" },
    {
      key: "fearGreed",
      shortLabel: "CNN",
      chartLabel: "CNN",
      accent: "#fbbf24",
      tooltip: "CNN Fear & Greed",
    },
    {
      key: "bofa",
      shortLabel: "BofA",
      chartLabel: "BofA",
      accent: "#c084fc",
      tooltip: "BofA Bull & Bear",
    },
    { key: "vxn", shortLabel: "VXN", chartLabel: "VXN", accent: "#2dd4bf", tooltip: "VXN 나스닥 변동성" },
  ],
  [
    { key: "putCall", shortLabel: "P/C", chartLabel: "P/C", accent: "#60a5fa", tooltip: "Put/Call 비율" },
    { key: "move", shortLabel: "MOVE", chartLabel: "MOVE", accent: "#fbbf24", tooltip: "MOVE 채권 변동성" },
    { key: "skew", shortLabel: "SKEW", chartLabel: "SKEW", accent: "#22d3ee", tooltip: "SKEW 꼬리위험" },
    {
      key: "highYield",
      shortLabel: "HY",
      chartLabel: "HY",
      accent: "#fb923c",
      tooltip: "하이일드 OAS",
    },
  ],
]

export const PANIC_INDEX_HISTORY_METRICS = PANIC_INDEX_HISTORY_ROWS.flat()

/** 핵심 3지표 — VIX · CNN · BofA */
export const PANIC_INDEX_CORE_HISTORY_ROWS = [PANIC_INDEX_HISTORY_ROWS[0]]

export const PANIC_INDEX_CORE_HISTORY_METRICS = PANIC_INDEX_CORE_HISTORY_ROWS.flat()

/** YDS 종합점수 — VIX·CNN·BofA·HY 가중 합산 */
export const YDS_COMPOSITE_HISTORY_METRIC = {
  key: "ydsComposite",
  shortLabel: "YDS",
  chartLabel: "YDS",
  accent: "#a78bfa",
  tooltip: "YDS 종합점수 (단기·중기 가중)",
}

/** @deprecated 실전/거시 탭 제거 — PANIC_INDEX_HISTORY_METRICS 사용 */
export const PANIC_V2_HISTORY_TAB = {
  key: "panicV2",
  label: "실전 V2",
  chartLabel: "실전",
  accent: "#f97316",
  badge: "TACTICAL",
  tooltip: "실전판단 · 매수타점 + 관심종목",
}

/** @deprecated */
export const PANIC_V1_HISTORY_TAB = {
  key: "panicV1",
  label: "거시 V1",
  chartLabel: "거시",
  accent: "#22d3ee",
  badge: "MACRO",
  tooltip: "거시판단 · 장기보유 + 비중조절",
}

/** 보조 탭 — 개별 지표 (전체) */
export const HISTORY_AUX_METRICS = [
  { key: "vix", label: "VIX · 변동성", chartLabel: "VIX", accent: "#f87171", tooltip: "S&P 500 내재 변동성" },
  { key: "vxn", label: "VXN · 나스닥", chartLabel: "VXN", accent: "#2dd4bf", tooltip: "나스닥 변동성 지수" },
  { key: "fearGreed", label: "CNN · 공포탐욕", chartLabel: "CNN", accent: "#fbbf24", tooltip: "CNN Fear & Greed" },
  { key: "bofa", label: "BofA · 심리", chartLabel: "BofA", accent: "#c084fc", tooltip: "BofA Bull/Bear 심리" },
  { key: "putCall", label: "P/C · 풋콜", chartLabel: "P/C", accent: "#60a5fa", tooltip: "옵션 Put/Call 비율" },
  {
    key: "highYield",
    label: "HY · 하이일드",
    chartLabel: "HY",
    accent: "#fb923c",
    tooltip: "하이일드 OAS 스프레드",
  },
  { key: "move", label: "MOVE · 채권", chartLabel: "MOVE", accent: "#fbbf24", tooltip: "채권 변동성 지표" },
  { key: "skew", label: "SKEW · 꼬리", chartLabel: "SKEW", accent: "#22d3ee", tooltip: "꼬리위험 지표" },
]

/** @deprecated PANIC_INDEX_HISTORY_METRICS 사용 */
export const HISTORY_SECTION_METRICS = HISTORY_AUX_METRICS

/** @deprecated PANIC_INDEX_HISTORY_METRICS 사용 */
export const HISTORY_TAB_METRICS = [
  PANIC_V2_HISTORY_TAB,
  PANIC_V1_HISTORY_TAB,
  ...HISTORY_AUX_METRICS,
]

/** @param {string} key */
export function findChartMetric(key) {
  const fromPanic = PANIC_INDEX_HISTORY_METRICS.find((m) => m.key === key)
  if (fromPanic) return fromPanic
  if (key === "ydsComposite") return YDS_COMPOSITE_HISTORY_METRIC
  if (key === "panicV2") return PANIC_V2_HISTORY_TAB
  if (key === "panicV1") return PANIC_V1_HISTORY_TAB
  return ALL_CHART_METRICS.find((m) => m.key === key) ?? HISTORY_AUX_METRICS.find((m) => m.key === key) ?? null
}
