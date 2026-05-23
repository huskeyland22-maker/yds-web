/**
 * 패닉지수 V2 가중치 (합 100)
 * 핵심 70 + 전문가 30
 */

/** @typedef {"core" | "expert"} PanicV2Group */

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
  { key: "vix", label: "VIX", shortLabel: "VIX", weight: 20, group: "core" },
  { key: "highYield", label: "HY 스프레드", shortLabel: "HY", weight: 15, group: "core" },
  { key: "move", label: "MOVE 채권", shortLabel: "MOVE", weight: 10, group: "core" },
  { key: "vxn", label: "VXN 나스닥", shortLabel: "VXN", weight: 10, group: "core" },
  { key: "putCall", label: "P/C 풋콜", shortLabel: "P/C", weight: 8, group: "core" },
  { key: "fearGreed", label: "CNN 공포탐욕", shortLabel: "CNN", weight: 7, group: "core" },
  { key: "skew", label: "SKEW 꼬리위험", shortLabel: "SKEW", weight: 10, group: "expert" },
  { key: "bofa", label: "BofA Bull Bear", shortLabel: "BofA", weight: 10, group: "expert" },
  { key: "gsBullBear", label: "GS 강세약세", shortLabel: "GS", weight: 10, group: "expert" },
]

export const PANIC_V2_CORE_WEIGHT_SUM = PANIC_V2_METRICS.filter((m) => m.group === "core").reduce(
  (s, m) => s + m.weight,
  0,
)

export const PANIC_V2_EXPERT_WEIGHT_SUM = PANIC_V2_METRICS.filter((m) => m.group === "expert").reduce(
  (s, m) => s + m.weight,
  0,
)
