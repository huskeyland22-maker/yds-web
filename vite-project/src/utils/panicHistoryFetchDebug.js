/**
 * 패닉 히스토리 로딩 디버그 — Cycle 차트 데이터 미표시 원인 추적
 */

import { getSupabaseBrowserClient } from "../lib/supabaseBrowser.js"
import { HISTORY_SECTION_METRICS } from "./panicDeskMetrics.js"

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
  "gs_sentiment",
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
  gsBullBear: "gs_sentiment",
  gsSentiment: "gs_sentiment",
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
          gsSentiment: sample.gsSentiment ?? sample.gsBullBear ?? sample.gs_sentiment,
        }
      : null,
  })
}

/** @param {object} row @param {string} uiKey */
function pickDbMetric(row, uiKey) {
  const db = UI_TO_DB[uiKey]
  if (!row || !db) return null
  if (uiKey === "highYield") return row.highYield ?? row.hyOas ?? row.hy_oas ?? row.high_yield
  if (uiKey === "gsBullBear") return row.gsBullBear ?? row.gsSentiment ?? row.gs_sentiment ?? row.gs_bb
  return row[uiKey] ?? row[db]
}

/** Supabase 직접 조회 — created_at 오름차순 (기간 필터 없음) */
export async function probePanicIndexHistoryDirect() {
  const client = getSupabaseBrowserClient()
  if (!client) {
    console.warn("[YDS] probePanicIndexHistoryDirect: Supabase client unavailable")
    return { data: null, error: { message: "supabase_client_unavailable" } }
  }
  const { data, error } = await client
    .from("panic_index_history")
    .select("*")
    .order("created_at", { ascending: true })
  console.log("[YDS] supabase panic_index_history (order created_at asc)", data)
  console.log("[YDS] supabase panic_index_history error", error)
  if (error) {
    console.error("[YDS] panic_index_history query error:", error.message, error)
  }
  return { data, error }
}
