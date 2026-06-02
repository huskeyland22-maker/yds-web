/**
 * cycleMetricHistory · panic_index_history 공통 row 해석
 */

import { PANIC_INDEX_HISTORY_KEY, panicIndexRowToCycleChart } from "./panicIndexHistory.js"
import { HISTORY_AUX_METRICS, HISTORY_TAB_METRICS } from "./panicDeskMetrics.js"
import { panicV1ScoreForRow } from "../panic-v2/panicV1History.js"
import { panicV2ScoreForRow } from "../panic-v2/panicV2History.js"
import { panicV2ScoreFromRow } from "../panic-v2/panicHistoryV2Backfill.js"
import { buildPanicV2DynamicSeries } from "../panic-v2/panicV2Dynamic.js"
import { panicDataFromCycleRow } from "./cycleHistoryUtils.js"
import { getFinalScore } from "./tradingScores.js"
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
  const panicV2 = toNum(
    row.panic_v2 ??
      row.panicV2 ??
      row.panicV2Score ??
      row.panicV2DynamicScore ??
      row.panic_index_v2 ??
      row.panic_v2_score,
  )
  if (panicV2 != null) {
    out.panic_v2 = panicV2
    out.panicV2Score = panicV2
    out.panicV2DynamicScore = panicV2
  }
  const vvix = toNum(row.vvix)
  const vixTerm = toNum(row.vixTerm ?? row.vix_term)
  const ndxDistance = toNum(row.ndxDistance ?? row.ndx_distance)
  const soxxDistance = toNum(row.soxxDistance ?? row.soxx_distance)
  const dxy = toNum(row.dxy)
  if (vvix != null) out.vvix = vvix
  if (vixTerm != null) out.vixTerm = vixTerm
  if (ndxDistance != null) out.ndxDistance = ndxDistance
  if (soxxDistance != null) out.soxxDistance = soxxDistance
  if (dxy != null) out.dxy = dxy
  return out
}

function rowValue(row, key) {
  if (!row) return null
  if (key === "panicV1") {
    const v = panicV1ScoreForRow(row)
    return Number.isFinite(v) ? v : null
  }
  if (key === "panicV2") {
    const cached = row.panic_v2 ?? row.panicV2DynamicScore ?? row.panicV2Score ?? row.panic_index_v2
    if (Number.isFinite(Number(cached))) return Number(cached)
    const v = panicV2ScoreFromRow(row)
    return Number.isFinite(v) ? v : null
  }
  if (key === "vvix") return Number(row.vvix)
  if (key === "vixTerm") {
    const n = Number(row.vixTerm ?? row.vix_term)
    return Number.isFinite(n) ? n : null
  }
  if (key === "ndxDistance") {
    const n = Number(row.ndxDistance ?? row.ndx_distance)
    return Number.isFinite(n) ? n : null
  }
  if (key === "soxxDistance") {
    const n = Number(row.soxxDistance ?? row.soxx_distance)
    return Number.isFinite(n) ? n : null
  }
  if (key === "dxy") return Number(row.dxy)
  if (key === "highYield" || key === "hyOas") return Number(row.highYield ?? row.hyOas)
  if (key === "gsBullBear") return Number(row.gsBullBear ?? row.gsSentiment)
  if (key === "panicScore") return Number(row.panicScore ?? row.panic_score)
  if (key === "ydsComposite") {
    const panic = panicDataFromCycleRow(row)
    if (!panic) return null
    const score = getFinalScore(panic)
    return Number.isFinite(score) ? score : null
  }
  return Number(row[key])
}

/** @param {object[]} history @param {string} metricKey */
export function countHistoryMetricPoints(history, metricKey) {
  if (!Array.isArray(history) || !metricKey) return 0
  if (metricKey === "panicV2") {
    const cached = history.filter((r) =>
      Number.isFinite(Number(r.panic_v2 ?? r.panicV2DynamicScore ?? r.panicV2Score)),
    ).length
    if (cached > 0) return cached
    return buildPanicV2DynamicSeries(history).filter((p) => p.score != null).length
  }
  return history.filter((r) => {
    const v = rowValue(r, metricKey)
    return v != null && Number.isFinite(v)
  }).length
}

/** @param {object[]} rows */
export function historyHasAnyMetric(rows) {
  if (!Array.isArray(rows) || !rows.length) return false
  return HISTORY_TAB_METRICS.some((m) => rows.some((r) => Number.isFinite(rowValue(r, m.key))))
}

/**
 * @param {object[]} rows
 * @param {string} [preferred]
 */
export function resolveDefaultHistoryMetric(rows, preferred = "vix") {
  const order = ["panicV2", "panicV1", "panicScore", "vix", ...HISTORY_AUX_METRICS.map((m) => m.key)]
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
      const prev = byDate.get(d)
      const merged = { ...prev, ...r, date: d }
      const prevV2 = toNum(prev?.panic_v2 ?? prev?.panicV2Score ?? prev?.panicV2)
      const nextV2 = toNum(merged.panic_v2 ?? merged.panicV2Score ?? merged.panicV2)
      if (prevV2 != null && nextV2 == null) {
        merged.panic_v2 = prevV2
        merged.panicV2Score = prev.panicV2Score ?? prevV2
        merged.panicV2DynamicScore = prev.panicV2DynamicScore ?? prevV2
      }
      byDate.set(d, merged)
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
