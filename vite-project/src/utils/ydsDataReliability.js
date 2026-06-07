/**
 * YDS V1.6.1 — panic_index_history 데이터 신뢰도·파이프라인 검증
 * UI: Hero Data Source Badge만. 나머지는 콘솔 추적.
 */

import { isDataTraceEnabled } from "./dataFlowTrace.js"

/** @typedef {'live' | 'cached' | 'local-fallback' | 'none'} YdsDataSourceBadgeKey */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function shouldLogReliability() {
  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) return true
  return isDataTraceEnabled()
}

/**
 * @param {'db' | 'api' | 'client' | 'diagnosis' | 'fallback'} stage
 * @param {Record<string, unknown>} detail
 */
export function logReliabilityPipeline(stage, detail = {}) {
  if (!shouldLogReliability()) return
  const line = { stage, t: new Date().toISOString(), ...detail }
  console.log(`[YDS_DATA] reliability:${stage}`, line)
}

/**
 * API 응답 스키마 검증 — fetchHistory invalid 원인 추적
 * @param {unknown} json
 */
export function validatePanicHistoryPayload(json) {
  if (Array.isArray(json)) {
    const rows = json
    const withDate = rows.filter((r) => DATE_RE.test(String(r?.date ?? "").slice(0, 10)))
    if (!rows.length) {
      return {
        ok: false,
        rows: [],
        cycleRows: [],
        invalidReason: "empty_array",
        schemaIssues: ["response_is_empty_array"],
      }
    }
    if (withDate.length < rows.length) {
      return {
        ok: true,
        rows: withDate,
        cycleRows: [],
        invalidReason: null,
        schemaIssues: [`${rows.length - withDate.length}_rows_missing_valid_date`],
        warning: "partial_rows_missing_date",
      }
    }
    return { ok: true, rows, cycleRows: [], invalidReason: null, schemaIssues: [] }
  }

  if (!json || typeof json !== "object") {
    return {
      ok: false,
      rows: [],
      cycleRows: [],
      invalidReason: "not_object_or_array",
      schemaIssues: [`typeof_${typeof json}`],
    }
  }

  const obj = /** @type {Record<string, unknown>} */ (json)
  const issues = []

  if (obj.ok === false) issues.push("ok_false")

  const dataField = obj.data
  let rowsFromData = []
  if (Array.isArray(dataField)) {
    rowsFromData = dataField
  } else if (dataField && typeof dataField === "object") {
    const nested = /** @type {{ rows?: unknown }} */ (dataField).rows
    if (Array.isArray(nested)) rowsFromData = nested
    else if (dataField != null) issues.push("data_not_array")
  }

  const rows = Array.isArray(obj.rows) ? obj.rows : rowsFromData
  if (!Array.isArray(obj.rows) && !Array.isArray(dataField) && rowsFromData.length === 0) {
    if (!("rows" in obj) && !("data" in obj)) issues.push("missing_rows_and_data")
    else if ("rows" in obj && !Array.isArray(obj.rows)) issues.push("rows_not_array")
  }

  const cycleRows = Array.isArray(obj.cycleRows) ? obj.cycleRows : []
  if ("cycleRows" in obj && !Array.isArray(obj.cycleRows)) issues.push("cycleRows_not_array")

  const datedRows = rows.filter((r) => DATE_RE.test(String(r?.date ?? "").slice(0, 10)))
  if (rows.length === 0) {
    issues.push("empty_rows")
    if (obj.warning) issues.push(`api_warning:${String(obj.warning)}`)
    if (obj.error) issues.push(`api_error:${String(obj.error)}`)
  } else if (datedRows.length < rows.length) {
    issues.push(`${rows.length - datedRows.length}_rows_missing_valid_date`)
  }

  const ok = obj.ok !== false && datedRows.length > 0
  const invalidReason =
    datedRows.length === 0
      ? issues.includes("empty_rows")
        ? obj.warning
          ? "api_warning_empty"
          : obj.error
            ? "api_error_empty"
            : "empty_rows"
        : "no_valid_dated_rows"
      : null

  return {
    ok: ok || datedRows.length > 0,
    rows: datedRows.length ? datedRows : rows,
    cycleRows,
    invalidReason,
    schemaIssues: issues,
    warning: obj.warning ?? null,
    meta: obj.meta && typeof obj.meta === "object" ? obj.meta : null,
  }
}

/**
 * hubRows / cycleRows = 0 원인 진단
 * @param {object} ctx
 */
export function diagnoseZeroHistoryRows(ctx) {
  const {
    dbRows = null,
    apiRows = null,
    hubRows = 0,
    mappedCycleRows = 0,
    localCycleRows = 0,
    invalidReason = null,
    schemaIssues = [],
    hubEnabled = true,
  } = ctx

  const causes = []

  if (!hubEnabled) causes.push("panic_hub_disabled")
  if (dbRows === 0) causes.push("supabase_table_empty")
  if (dbRows == null) causes.push("db_probe_unavailable")
  if (invalidReason) causes.push(`api_invalid:${invalidReason}`)
  if (schemaIssues?.length) causes.push(...schemaIssues.map((s) => `schema:${s}`))
  if (apiRows === 0 && hubEnabled) causes.push("api_returned_zero_rows")
  if (hubRows === 0 && apiRows > 0) causes.push("client_parse_dropped_all_rows")
  if (hubRows > 0 && mappedCycleRows === 0) {
    causes.push("history_to_cycle_mapping_failed")
    causes.push("check_date_format_YYYY-MM-DD")
  }
  if (mappedCycleRows === 0 && localCycleRows > 0) {
    causes.push("will_use_localStorage_fallback")
  }
  if (mappedCycleRows === 0 && localCycleRows === 0) {
    causes.push("no_local_seed_available")
  }

  const summary =
    hubRows === 0
      ? apiRows === 0
        ? "API empty — check Supabase panic_index_history"
        : "Client dropped API rows — check response shape"
      : mappedCycleRows === 0
        ? "Mapping failed — rows lack valid date field"
        : null

  return { causes, summary }
}

/**
 * @param {object} ctx
 * @returns {{ key: YdsDataSourceBadgeKey, label: string, emoji: string }}
 */
export function resolveDataSourceBadge(ctx) {
  const {
    source = "none",
    realtime = false,
    fallbackUsed = false,
    clientRows = 0,
    invalidReason = null,
  } = ctx

  if (fallbackUsed || source === "localStorage") {
    return { key: "local-fallback", label: "Local Fallback", emoji: "🔴" }
  }
  if (source === "supabase-index-history" && realtime && clientRows > 0 && !invalidReason) {
    return { key: "live", label: "Live (Supabase)", emoji: "🟢" }
  }
  if (clientRows > 0 && (source === "static-json" || !realtime)) {
    return { key: "cached", label: "Cached", emoji: "🟡" }
  }
  if (source === "supabase-index-history" && clientRows > 0) {
    return { key: "live", label: "Live (Supabase)", emoji: "🟢" }
  }
  if (clientRows === 0) {
    return { key: "local-fallback", label: "Local Fallback", emoji: "🔴" }
  }
  return { key: "cached", label: "Cached", emoji: "🟡" }
}

/**
 * @param {object} pipeline
 * @param {object} [extra]
 */
export function buildCycleDataReliability(pipeline, extra = {}) {
  const clientRows = pipeline.clientRows ?? 0
  const badge = resolveDataSourceBadge({
    source: extra.source ?? "none",
    realtime: Boolean(extra.realtime),
    fallbackUsed: Boolean(extra.fallbackUsed),
    clientRows,
    invalidReason: extra.invalidReason ?? null,
  })
  return {
    badge: badge.key,
    badgeLabel: badge.label,
    badgeEmoji: badge.emoji,
    pipeline,
    fallbackUsed: Boolean(extra.fallbackUsed),
    fallbackReason: extra.fallbackReason ?? null,
    invalidReason: extra.invalidReason ?? null,
    diagnosis: extra.diagnosis ?? null,
    updatedAt: Date.now(),
  }
}
