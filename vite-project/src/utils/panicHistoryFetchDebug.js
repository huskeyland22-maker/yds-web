/**
 * 패닉 히스토리 로딩 디버그 — Cycle 차트 데이터 미표시 원인 추적
 */

import { getSupabaseBrowserClient } from "../lib/supabaseBrowser.js"
import { HISTORY_SECTION_METRICS } from "./panicDeskMetrics.js"
import { logReliabilityPipeline } from "./ydsDataReliability.js"

/** 기간 슬라이스 임시 OFF (데이터 확인 후 false) */
export const PANIC_HISTORY_DISABLE_RANGE_SLICE = true

const DB_METRIC_KEYS = [
  "vix",
  "fear_greed",
  "put_call",
  "move",
  "bofa",
  "skew",
  "hy_oas",
]

const UI_TO_DB = {
  vix: "vix",
  fearGreed: "fear_greed",
  putCall: "put_call",
  move: "move",
  bofa: "bofa",
  skew: "skew",
  highYield: "hy_oas",
  hyOas: "hy_oas",
}

/**
 * @param {object[]} rows
 * @param {string} [selectedMetric]
 * @param {string} [selectedRange]
 */
export function logHistoryFetchDebug(rows, selectedMetric, selectedRange) {
  console.log("history rows", rows?.length, rows)
  console.log("selectedMetric", selectedMetric)
  console.log("range", selectedRange)
}

/**
 * @param {object[]} rows
 */
export function logHistoryMetricMapping(rows) {
  const sample = Array.isArray(rows) && rows.length ? rows[rows.length - 1] : null
  console.log("[YDS] panic history metric map (UI → DB)", {
    mappings: HISTORY_SECTION_METRICS.map((m) => ({
      ui: m.label,
      uiKey: m.key,
      dbKey: UI_TO_DB[m.key] ?? m.key,
      sampleValue: sample ? pickDbMetric(sample, m.key) : null,
    })),
    dbColumnsPresent: sample
      ? DB_METRIC_KEYS.reduce((acc, k) => {
          acc[k] = sample[k] != null ? sample[k] : null
          return acc
        }, {})
      : null,
    camelPresent: sample
      ? {
          vix: sample.vix,
          fearGreed: sample.fearGreed ?? sample.fear_greed,
          putCall: sample.putCall ?? sample.put_call,
          hyOas: sample.hyOas ?? sample.highYield ?? sample.hy_oas,
        }
      : null,
  })
}

/** @param {object} row @param {string} uiKey */
function pickDbMetric(row, uiKey) {
  const db = UI_TO_DB[uiKey]
  if (!row || !db) return null
  if (uiKey === "highYield") return row.highYield ?? row.hyOas ?? row.hy_oas ?? row.high_yield
  return row[uiKey] ?? row[db]
}

/** Supabase 직접 조회 — created_at 오름차순 (기간 필터 없음) */
export async function probePanicIndexHistoryDirect() {
  const client = getSupabaseBrowserClient()
  if (!client) {
    console.warn("[YDS] probePanicIndexHistoryDirect: Supabase client unavailable")
    logReliabilityPipeline("db", { dbRows: null, error: "supabase_client_unavailable" })
    return { data: null, error: { message: "supabase_client_unavailable" }, count: null }
  }
  const { data, error } = await client
    .from("panic_index_history")
    .select("date,created_at")
    .order("created_at", { ascending: true })
  const count = Array.isArray(data) ? data.length : 0
  logReliabilityPipeline("db", {
    dbRows: count,
    error: error?.message ?? null,
    firstDate: data?.[0]?.date ?? null,
    lastDate: data?.length ? data[data.length - 1]?.date ?? null : null,
  })
  if (error) {
    console.error("[YDS] panic_index_history query error:", error.message, error)
  }
  return { data, error, count }
}
