import { auditDelta, inferDeltaMethod } from "./deltaSemantics.js"

/**
 * DEV ONLY — source / raw / previous / delta / method (+ 검증 경고).
 * @param {Record<string, import('./rawLayer.js').MetricSeries>} raw
 * @param {Record<string, string>} [sources]
 */
export function buildDevValidation(raw, sources = {}) {
  return Object.entries(raw).map(([key, series]) => {
    const source = mapSourceLabel(sources[key] ?? "staticSeed")
    const method20 = inferDeltaMethod(key, series.current, series.change20D, "20D")
    const audit20 = auditDelta(key, series.current, series.change20D, "20D")
    const deltaStr = formatDeltaLine(key, series, method20)

    return {
      key: displayKey(key),
      source,
      raw: series.current,
      previous1D: series.previous1D ?? null,
      previous5D: series.previous5D ?? null,
      previous20D: series.previous20D ?? null,
      delta: deltaStr,
      method: audit20?.ok === false ? `${method20} ⚠` : method20,
      warning: audit20?.ok === false ? audit20.warning : null,
    }
  })
}

function displayKey(key) {
  if (key === "US10Y") return "10Y"
  if (key === "US2Y") return "2Y"
  if (key === "US30Y") return "30Y"
  return key
}

function mapSourceLabel(source) {
  if (source === "market-data") return "LIVE:/api/market-data"
  if (source === "macro-risk-seed.json") return "MOCK:seed.json"
  if (source === "panicContext") return "LIVE:panic"
  if (source === "market-data+panic") return "LIVE:market+panic"
  return "STATIC:seed"
}

function formatDeltaLine(key, series, method20) {
  const parts = []
  if (series.change1D != null) {
    const m = inferDeltaMethod(key, series.current, series.change1D, "1D")
    parts.push(`1D ${fmtSigned(series.change1D, m, key)}`)
  }
  if (series.change5D != null) {
    const m = inferDeltaMethod(key, series.current, series.change5D, "5D")
    parts.push(`5D ${fmtSigned(series.change5D, m, key)}`)
  }
  if (series.change20D != null) {
    parts.push(`20D ${fmtSigned(series.change20D, method20, key)}`)
  }
  return parts.join(" · ") || "—"
}

function fmtSigned(v, method, key) {
  const n = Number(v)
  const sign = n > 0 ? "+" : ""
  if (method === "percent_suspect") return `${sign}${n.toFixed(2)} (percent?)`
  if (key === "DXY" || key === "MOVE" || key === "VXN") return `${sign}${n.toFixed(2)}`
  return `${sign}${n.toFixed(2)}`
}
