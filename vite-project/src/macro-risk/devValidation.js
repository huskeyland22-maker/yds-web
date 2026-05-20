/**
 * DEV ONLY — 데이터 출처·델타·계산 방식 추적 (실연동 검증용 UI).
 * @param {Record<string, import('./rawLayer.js').MetricSeries>} raw
 * @param {Record<string, string>} [sources]
 */
export function buildDevValidation(raw, sources = {}) {
  return Object.entries(raw).map(([key, series]) => {
    const source = sources[key] ?? "staticSeed"
    const method = methodForSource(source)
    const delta = [
      fmtDelta("1D", series.change1D),
      fmtDelta("5D", series.change5D),
      fmtDelta("20D", series.change20D),
      `slope ${series.slope}`,
    ].join(" · ")

    return {
      key,
      raw: {
        current: series.current,
        change1D: series.change1D,
        change5D: series.change5D,
        change20D: series.change20D,
        slope: series.slope,
        status: series.status,
      },
      source,
      delta,
      method,
    }
  })
}

function methodForSource(source) {
  if (source === "market-data") return "synthesizeFromSpot(/api/market-data 1D%)"
  if (source === "macro-risk-seed.json") return "public/macro-risk-seed.json merge"
  if (source === "panicContext") return "panicContext field (read-only)"
  if (source === "market-data+panic") return "market-data + panicContext fallback"
  return "MACRO_RISK_SEED_HISTORY"
}

function fmtDelta(label, v) {
  if (v == null || !Number.isFinite(Number(v))) return `${label} —`
  const n = Number(v)
  const sign = n > 0 ? "+" : ""
  return `${label} ${sign}${n.toFixed(3)}`
}
