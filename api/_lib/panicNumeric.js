/**
 * Supabase double precision — never send string numbers.
 * @param {unknown} value
 * @returns {number | null}
 */
export function metricValueForDb(value) {
  if (value == null || value === "") return null
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  // Never persist toFixed() strings — always parse back to number.
  const n = Number(
    String(value)
      .replace(/,/g, "")
      .trim(),
  )
  return Number.isFinite(n) ? n : null
}

/** Use when rounding is needed — never assign toFixed() result without parseFloat. */
export function roundMetricValueForDb(value, decimals = 2) {
  const n = metricValueForDb(value)
  if (n == null) return null
  return parseFloat(Number(n).toFixed(decimals))
}

/** Vercel log — insert payload types (metric_key / metric_name). */
export function logPanicInsertPayloadTable(rows, label = "INSERT_PAYLOAD") {
  const list = Array.isArray(rows) ? rows : [rows]
  console.log(label)
  console.table(
    list.map((x) => ({
      metric: x?.metric_name ?? x?.metric_key ?? "?",
      value: x?.metric_value,
      type: typeof x?.metric_value,
    })),
  )
  const json = JSON.stringify(list)
  const quotedMetricValue = /"metric_value"\s*:\s*"/.test(json)
  if (quotedMetricValue) {
    console.error(`${label}_JSON_STRING_METRIC_VALUE`, json.slice(0, 2000))
  } else {
    console.log(`${label}_JSON_OK`, "metric_value fields are JSON numbers (not quoted strings)")
  }
}

/** @alias metricValueForDb */
export function toDbDouble(value) {
  return metricValueForDb(value)
}

/** @param {Array<Record<string, unknown>>} rows */
export function finalizePanicMetricRows(rows, { log = false, source = "" } = {}) {
  if (!Array.isArray(rows)) return []
  return rows.map((row) => {
    const metricValue = metricValueForDb(row?.metric_value)
    const changePercent = metricValueForDb(row?.change_percent)
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
      metric_key: String(row?.metric_key ?? ""),
      metric_value: metricValue,
      change_percent: changePercent,
      status: row?.status == null ? null : String(row.status),
      market: row?.market == null ? null : String(row.market),
      source: row?.source == null ? null : String(row.source),
      updated_at:
        typeof row?.updated_at === "string" && row.updated_at
          ? row.updated_at
          : new Date().toISOString(),
    }
  })
}

/** @param {Array<{ metric_value: unknown }>} rows */
export function assertPanicMetricRowsNumeric(rows) {
  if (!Array.isArray(rows)) return
  for (const x of rows) {
    if (x.metric_value !== null && typeof x.metric_value !== "number") {
      throw new Error(
        `metric_value not number: key=${x.metric_key} value=${String(x.metric_value)} type=${typeof x.metric_value}`,
      )
    }
    if (x.change_percent !== null && typeof x.change_percent !== "number") {
      throw new Error(
        `change_percent not number: key=${x.metric_key} type=${typeof x.change_percent}`,
      )
    }
  }
}

/** @deprecated use finalizePanicMetricRows */
export function sanitizePanicMetricRows(rows, opts = {}) {
  return finalizePanicMetricRows(rows, opts)
}

const HISTORY_DOUBLE_KEYS = [
  "vix",
  "vxn",
  "fear_greed",
  "put_call",
  "move",
  "bofa",
  "skew",
  "hy_oas",
  "high_yield",
  "gs_sentiment",
  "gs_bb",
]

/** @param {Record<string, unknown>} row */
export function finalizePanicHistoryRow(row) {
  if (!row || typeof row !== "object") return row
  /** @type {Record<string, unknown>} */
  const out = {
    date: String(row.date ?? "").slice(0, 10),
    source: row.source == null ? "manual" : String(row.source),
    updated_at:
      typeof row.updated_at === "string" && row.updated_at
        ? row.updated_at
        : new Date().toISOString(),
    market: row.market == null ? "global" : String(row.market),
  }
  for (const key of HISTORY_DOUBLE_KEYS) {
    if (key in row) out[key] = metricValueForDb(row[key])
  }
  return out
}

/** @deprecated use finalizePanicHistoryRow */
export function sanitizePanicHistoryRow(row) {
  return finalizePanicHistoryRow(row)
}

/** @param {Record<string, unknown>} row */
export function assertPanicHistoryRowNumeric(row) {
  if (!row || typeof row !== "object") return
  for (const key of HISTORY_DOUBLE_KEYS) {
    if (!(key in row)) continue
    const v = row[key]
    if (v !== null && typeof v !== "number") {
      throw new Error(`panic_index_history.${key} not number: ${String(v)} type=${typeof v}`)
    }
  }
}

export function logPanicPipelineStage(stage, data) {
  console.log(`[panic pipeline] ${stage}`)
  if (!data || typeof data !== "object") return
  const keys = [
    "vix",
    "vxn",
    "fearGreed",
    "putCall",
    "bofa",
    "move",
    "skew",
    "highYield",
    "gsBullBear",
  ]
  for (const key of keys) {
    if (key in data) {
      const v = data[key]
      console.log("[panic pipeline]", stage, key, v, typeof v)
    }
  }
}
