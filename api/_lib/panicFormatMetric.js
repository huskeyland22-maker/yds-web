/** 서버용 — macroCycleChartUtils 의존 없음 */
export function formatMetricValue(key, v) {
  if (!Number.isFinite(v)) return "—"
  if (key === "putCall") return v.toFixed(2)
  if (key === "fearGreed" || key === "gsBullBear") return String(Math.round(v))
  if (key === "highYield") return v.toFixed(2)
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}
