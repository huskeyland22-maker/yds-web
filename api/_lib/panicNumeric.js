/**
 * Supabase double precision columns — never send string numbers.
 * @param {unknown} value
 * @returns {number | null}
 */
export function toDbDouble(value) {
  if (value == null || value === "") return null
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === "boolean") return null
  const s = String(value)
    .trim()
    .replace(/%/g, "")
    .replace(/,/g, "")
    .replace(/[—–−]/g, "-")
  if (!s || s === "-" || s === "null" || s === "undefined") return null
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

/** @param {Array<Record<string, unknown>>} rows */
export function sanitizePanicMetricRows(rows, { log = false, source = "" } = {}) {
  if (!Array.isArray(rows)) return []
  return rows.map((row) => {
    const metricValue = toDbDouble(row?.metric_value)
    const changePercent = toDbDouble(row?.change_percent)
    if (log) {
      console.log(
        "[panic_metrics]",
        source,
        row?.metric_key,
        "in=",
        row?.metric_value,
        typeof row?.metric_value,
        "out=",
        metricValue,
        typeof metricValue,
      )
    }
    return {
      ...row,
      metric_value: metricValue,
      change_percent: changePercent,
    }
  })
}

/** @param {Record<string, unknown>} row */
export function sanitizePanicHistoryRow(row) {
  if (!row || typeof row !== "object") return row
  return {
    ...row,
    vix: toDbDouble(row.vix),
    vxn: toDbDouble(row.vxn),
    fear_greed: toDbDouble(row.fear_greed),
    put_call: toDbDouble(row.put_call),
    move: toDbDouble(row.move),
    bofa: toDbDouble(row.bofa),
    skew: toDbDouble(row.skew),
    hy_oas: toDbDouble(row.hy_oas),
    gs_sentiment: toDbDouble(row.gs_sentiment),
    high_yield: toDbDouble(row.high_yield),
    gs_bb: toDbDouble(row.gs_bb),
  }
}
