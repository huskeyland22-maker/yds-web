/**
 * cycleMetricHistory · panic_index_history 공통 row 해석
 */

import { PANIC_INDEX_HISTORY_KEY, panicIndexRowToCycleChart } from "./panicIndexHistory.js"
import { HISTORY_SECTION_METRICS } from "./panicDeskMetrics.js"
import {
  loadStoredPanicHistory,
  panicHistoryLocalToCycleRows,
} from "./panicHistoryLocalPersist.js"

function toNum(v) {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** API·LS 혼합 row → cycle 차트 row */
export function rawRowToCycle(row) {
  if (!row || typeof row !== "object") return null
  const date = String(row.date ?? row.ts ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const out = {
    date,
    ts: `${date}T12:00:00.000Z`,
    vix: toNum(row.vix),
    vxn: toNum(row.vxn),
    fearGreed: toNum(row.fearGreed ?? row.fear_greed),
    putCall: toNum(row.putCall ?? row.put_call),
    move: toNum(row.move),
    bofa: toNum(row.bofa),
    skew: toNum(row.skew),
    highYield: toNum(row.highYield ?? row.hyOas ?? row.high_yield),
    gsBullBear: toNum(row.gsBullBear ?? row.gsSentiment ?? row.gs_sentiment),
    panicScore: toNum(row.panicScore ?? row.panic_score),
  }
  return out
}

function rowValue(row, key) {
  if (!row) return null
  if (key === "highYield" || key === "hyOas") return Number(row.highYield ?? row.hyOas)
  if (key === "gsBullBear") return Number(row.gsBullBear ?? row.gsSentiment)
  if (key === "panicScore") return Number(row.panicScore ?? row.panic_score)
  return Number(row[key])
}

/** @param {object[]} history @param {string} metricKey */
export function countHistoryMetricPoints(history, metricKey) {
  if (!Array.isArray(history) || !metricKey) return 0
  return history.filter((r) => {
    const v = rowValue(r, metricKey)
    return v != null && Number.isFinite(v)
  }).length
}

/** @param {object[]} rows */
export function historyHasAnyMetric(rows) {
  if (!Array.isArray(rows) || !rows.length) return false
  return HISTORY_SECTION_METRICS.some((m) => rows.some((r) => Number.isFinite(rowValue(r, m.key))))
}

/**
 * @param {object[]} rows
 * @param {string} [preferred]
 */
export function resolveDefaultHistoryMetric(rows, preferred = "vix") {
  const order = ["panicScore", "vix", ...HISTORY_SECTION_METRICS.map((m) => m.key)]
  const seen = new Set()
  for (const key of [preferred, ...order]) {
    if (!key || seen.has(key)) continue
    seen.add(key)
    if (rows.some((r) => Number.isFinite(rowValue(r, key)))) return key
  }
  return preferred
}

/** @param {object[]} rows @param {string} metricKey */
export function filterHistoryRowsForMetric(rows, metricKey) {
  if (!Array.isArray(rows) || !metricKey) return []
  return rows.filter((r) => Number.isFinite(rowValue(r, metricKey)))
}

function mapRows(arr) {
  const out = []
  for (const r of arr) {
    const c = panicIndexRowToCycleChart(r) ?? rawRowToCycle(r)
    if (c) out.push(c)
  }
  const byDate = new Map()
  for (const r of out) byDate.set(r.date, r)
  return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

/** 여러 소스 병합 — store 1건이 seed 5건을 덮어쓰지 않음 */
function mergeCycleHistorySources(...lists) {
  const byDate = new Map()
  for (const list of lists) {
    if (!Array.isArray(list)) continue
    for (const r of list) {
      if (!r?.date) continue
      const d = String(r.date).slice(0, 10)
      byDate.set(d, { ...byDate.get(d), ...r, date: d })
    }
  }
  return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

/**
 * props rows + localStorage + legacy fallback (병합)
 * @param {object[] | undefined} rows
 */
export function resolveCycleHistoryRows(rows) {
  const fromProp = mapRows(Array.isArray(rows) ? rows : [])
  const fromPanicHistory = panicHistoryLocalToCycleRows(loadStoredPanicHistory())

  let fromLegacy = []
  if (typeof window !== "undefined") {
    try {
      const raw = JSON.parse(window.localStorage.getItem(PANIC_INDEX_HISTORY_KEY) || "[]")
      fromLegacy = mapRows(Array.isArray(raw) ? raw : [])
    } catch {
      fromLegacy = []
    }
  }

  return mergeCycleHistorySources(fromProp, fromPanicHistory, fromLegacy)
}
