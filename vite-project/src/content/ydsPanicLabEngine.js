/**
 * 패닉 연구실 — 히스토리·이벤트·구간·성과·구성요소 분석
 */

import { normalizeSpyPriceSeries } from "./ydsEventScorecard.js"
import { buildYdsScoreBreakdown } from "../trading-zone/ydsScoreBreakdown.js"
import { mergeYdsSourceHistory } from "../trading-zone/ydsSignalHistory.js"
import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import { panicDataFromCycleRow } from "../utils/cycleHistoryUtils.js"
import {
  getFinalScore,
  scoreBofa,
  scoreFearGreed,
  scoreHY,
  scorePutCall,
  scoreVIX,
} from "../utils/tradingScores.js"
import { interpretPanicMetric } from "../utils/panicMetricInterpretation.js"

/** @typedef {import("./ydsEtfDailyLoader.js").EtfBenchmarkId} EtfBenchmarkId */

export const PANIC_EVENT_THRESHOLD = 80

export const PANIC_BANDS = [
  { id: "0-20", label: "0~20", min: 0, max: 20 },
  { id: "20-40", label: "20~40", min: 20, max: 40 },
  { id: "40-60", label: "40~60", min: 40, max: 60 },
  { id: "60-80", label: "60~80", min: 60, max: 80 },
  { id: "80-100", label: "80~100", min: 80, max: 100 },
]

export const PANIC_LAB_HORIZONS = [
  { key: "d7", days: 7, label: "7일" },
  { key: "d30", days: 30, label: "30일" },
  { key: "d90", days: 90, label: "90일" },
]

/** @type {{ key: string; label: string }[]} */
export const PANIC_LAB_COMPONENTS = [
  { key: "vix", label: "VIX" },
  { key: "fearGreed", label: "CNN" },
  { key: "putCall", label: "Put/Call" },
  { key: "bofa", label: "BofA" },
  { key: "move", label: "MOVE" },
  { key: "skew", label: "SKEW" },
  { key: "highYield", label: "HY OAS" },
  { key: "vxn", label: "VXN" },
]

const CONTRIB_LABELS = {
  vix: "VIX",
  cnn: "CNN",
  bofa: "BofA",
  highYield: "HY OAS",
  putCall: "Put/Call",
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function rowRaw(row, key) {
  if (key === "highYield") return toNum(row.highYield ?? row.hyOas)
  return toNum(row[key])
}

/** @param {string} key @param {number | null} value */
export function componentFearScore(key, value) {
  const v = toNum(value)
  if (v == null) return null
  switch (key) {
    case "vix":
    case "vxn":
      return scoreVIX(v)
    case "fearGreed":
      return scoreFearGreed(v)
    case "putCall":
      return scorePutCall(v)
    case "bofa":
      return scoreBofa(v)
    case "highYield":
      return scoreHY(v)
    case "move":
      return clamp(((v - 80) / 60) * 100, 0, 100)
    case "skew":
      return clamp(((v - 125) / 40) * 100, 0, 100)
    default:
      return null
  }
}

/** @param {object} row */
export function panicScoreForRow(row) {
  const panic = panicDataFromCycleRow(row)
  if (!panic) return null
  const score = getFinalScore(panic)
  return Number.isFinite(score) ? score : null
}

/**
 * @param {object[]} historyRows
 */
export function buildPanicIntensitySeries(historyRows) {
  const merged = mergeYdsSourceHistory(historyRows)
  const series = merged
    .map((row) => {
      const score = panicScoreForRow(row)
      if (score == null) return null
      return {
        date: String(row.date).slice(0, 10),
        score,
        stage: resolveMacroV1Status(score),
      }
    })
    .filter(Boolean)

  if (!series.length) {
    return { series: [], min: null, max: null, minDate: null, maxDate: null }
  }

  let min = series[0]
  let max = series[0]
  for (const p of series) {
    if (p.score < min.score) min = p
    if (p.score > max.score) max = p
  }

  return {
    series,
    min: min.score,
    max: max.score,
    minDate: min.date,
    maxDate: max.date,
    minStage: min.stage?.label ?? "—",
    maxStage: max.stage?.label ?? "—",
  }
}

/**
 * @param {string[]} sortedDates
 * @param {Record<string, number>} prices
 * @param {number} startIdx
 * @param {number} horizonDays
 */
function forwardReturnPct(sortedDates, prices, startIdx, horizonDays) {
  const endIdx = startIdx + horizonDays
  if (endIdx >= sortedDates.length) return null
  const start = prices[sortedDates[startIdx]]
  const end = prices[sortedDates[endIdx]]
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0) return null
  return Math.round(((end - start) / start) * 1000) / 10
}

/**
 * @param {string} eventDate
 * @param {Record<EtfBenchmarkId, Record<string, number>>} benchmarks
 */
function forwardReturnsForDate(eventDate, benchmarks) {
  /** @type {Record<string, Record<string, number | null>>} */
  const out = {}
  for (const id of ["SPY", "QQQ", "SOXX"]) {
    const { sortedDates, prices } = normalizeSpyPriceSeries(benchmarks[id] ?? {})
    out[id] = {}
    if (!sortedDates.length) {
      for (const h of PANIC_LAB_HORIZONS) out[id][h.key] = null
      continue
    }
    let idx = -1
    for (let i = 0; i < sortedDates.length; i += 1) {
      if (sortedDates[i] >= eventDate) {
        idx = i
        break
      }
    }
    if (idx < 0) {
      for (const h of PANIC_LAB_HORIZONS) out[id][h.key] = null
      continue
    }
    for (const h of PANIC_LAB_HORIZONS) {
      out[id][h.key] = forwardReturnPct(sortedDates, prices, idx, h.days)
    }
  }
  return out
}

/** @param {object} row @param {number} score */
function describeEventCause(row, score) {
  const breakdown = buildYdsScoreBreakdown({
    vix: row.vix,
    cnn: row.fearGreed,
    bofa: row.bofa,
    putCall: row.putCall,
    highYield: row.highYield ?? row.hyOas,
  })

  if (breakdown.computable && breakdown.contributions) {
    const top = Object.entries(breakdown.contributions).sort((a, b) => b[1] - a[1])[0]
    if (top) {
      const label = CONTRIB_LABELS[top[0]] ?? top[0]
      return `${label} 기여 +${top[1]}점 · ${breakdown.weightNote ?? ""}`.trim()
    }
  }

  const drivers = []
  for (const { key, label } of PANIC_LAB_COMPONENTS) {
    const raw = rowRaw(row, key)
    const ins = interpretPanicMetric(key === "fearGreed" ? "fearGreed" : key, raw)
    if (ins?.tone === "danger" || ins?.tone === "warning") {
      drivers.push(`${label} ${ins.statusLabel}`)
    }
  }
  if (drivers.length) return drivers.slice(0, 2).join(" · ")
  return score >= 85 ? "극단 공포 복합 신호" : "공포 지표 동반 상승"
}

/** @param {object} row @param {number} score */
function describeMarketContext(row, score) {
  const stage = resolveMacroV1Status(score)
  const vix = rowRaw(row, "vix")
  const cnn = rowRaw(row, "fearGreed")
  const parts = [stage?.label ? `시장 ${stage.label}` : null]
  if (vix != null) parts.push(`VIX ${vix.toFixed(1)}`)
  if (cnn != null) parts.push(`CNN ${cnn.toFixed(0)}`)
  return parts.filter(Boolean).join(" · ")
}

/**
 * @param {object[]} historyRows
 * @param {Record<EtfBenchmarkId, Record<string, number>>} benchmarks
 */
export function detectPanicEvents(historyRows, benchmarks) {
  const merged = mergeYdsSourceHistory(historyRows)
  /** @type {Array<{ date: string; score: number; row: object }>} */
  const clusters = []
  /** @type {Array<{ date: string; score: number; row: object }>} */
  let current = []

  for (const row of merged) {
    const score = panicScoreForRow(row)
    if (score == null) continue
    const date = String(row.date).slice(0, 10)
    if (score >= PANIC_EVENT_THRESHOLD) {
      current.push({ date, score, row })
    } else if (current.length) {
      clusters.push(...finalizePanicClusters(current))
      current = []
    }
  }
  if (current.length) clusters.push(...finalizePanicClusters(current))

  return clusters.map((peak) => {
    const returns = forwardReturnsForDate(peak.date, benchmarks)
    return {
      id: `panic-${peak.date}`,
      date: peak.date,
      score: peak.score,
      cause: describeEventCause(peak.row, peak.score),
      marketContext: describeMarketContext(peak.row, peak.score),
      stageLabel: resolveMacroV1Status(peak.score)?.label ?? "—",
      returns,
      breakdown: buildYdsScoreBreakdown({
        vix: peak.row.vix,
        cnn: peak.row.fearGreed,
        bofa: peak.row.bofa,
        putCall: peak.row.putCall,
        highYield: peak.row.highYield ?? peak.row.hyOas,
      }),
    }
  })
}

/** @param {Array<{ date: string; score: number; row: object }>} cluster */
function finalizePanicClusters(cluster) {
  const peak = cluster.reduce((best, cur) => (cur.score > best.score ? cur : best), cluster[0])
  return [peak]
}

/**
 * @param {object[]} events
 * @param {Record<EtfBenchmarkId, Record<string, number>>} benchmarks
 */
export function summarizePanicForwardPerformance(events, benchmarks) {
  const ids = /** @type {EtfBenchmarkId[]} */ (["SPY", "QQQ", "SOXX"])
  return ids.map((id) => {
    const horizons = PANIC_LAB_HORIZONS.map((h) => {
      const vals = (events ?? [])
        .map((e) => e.returns?.[id]?.[h.key])
        .filter((v) => v != null && Number.isFinite(v))
      const avg =
        vals.length > 0 ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : null
      return { ...h, avgReturn: avg, count: vals.length }
    })
    return { id, label: id, horizons }
  })
}

/**
 * @param {object[]} historyRows
 * @param {Record<EtfBenchmarkId, Record<string, number>>} benchmarks
 */
export function buildPanicBandStats(historyRows, benchmarks) {
  const merged = mergeYdsSourceHistory(historyRows)
  const { sortedDates, prices } = normalizeSpyPriceSeries(benchmarks.SPY ?? {})

  return PANIC_BANDS.map((band) => {
    /** @type {number[]} */
    const forward30 = []
    let dayCount = 0

    for (const row of merged) {
      const score = panicScoreForRow(row)
      if (score == null) continue
      const inBand = score >= band.min && (band.max >= 100 ? score <= 100 : score < band.max)
      if (!inBand) continue
      dayCount += 1

      if (!sortedDates.length) continue
      const date = String(row.date).slice(0, 10)
      let idx = -1
      for (let i = 0; i < sortedDates.length; i += 1) {
        if (sortedDates[i] >= date) {
          idx = i
          break
        }
      }
      if (idx < 0) continue
      const ret30 = forwardReturnPct(sortedDates, prices, idx, 30)
      if (ret30 != null) forward30.push(ret30)
    }

    const avgReturn =
      forward30.length > 0
        ? Math.round((forward30.reduce((s, v) => s + v, 0) / forward30.length) * 10) / 10
        : null

    return {
      ...band,
      frequency: dayCount,
      avgReturn30d: avgReturn,
      sample30d: forward30.length,
    }
  })
}

/**
 * @param {object[]} historyRows
 */
export function buildPanicComponentAnalysis(historyRows) {
  const merged = mergeYdsSourceHistory(historyRows)
  const panicDays = merged.filter((row) => {
    const score = panicScoreForRow(row)
    return score != null && score >= PANIC_EVENT_THRESHOLD
  })

  const pool = panicDays.length ? panicDays : merged
  /** @type {Record<string, number[]>} */
  const scoresByKey = {}
  for (const { key } of PANIC_LAB_COMPONENTS) scoresByKey[key] = []

  for (const row of pool) {
    for (const { key } of PANIC_LAB_COMPONENTS) {
      const fs = componentFearScore(key, rowRaw(row, key))
      if (fs != null) scoresByKey[key].push(fs)
    }
  }

  const items = PANIC_LAB_COMPONENTS.map(({ key, label }) => {
    const vals = scoresByKey[key] ?? []
    const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
    return { key, label, avgScore: avg != null ? Math.round(avg * 10) / 10 : null, samples: vals.length }
  }).filter((i) => i.samples > 0)

  const total = items.reduce((s, i) => s + (i.avgScore ?? 0), 0) || 1
  return items
    .map((i) => ({
      ...i,
      sharePct: i.avgScore != null ? Math.round((i.avgScore / total) * 1000) / 10 : null,
    }))
    .sort((a, b) => (b.sharePct ?? 0) - (a.sharePct ?? 0))
}

/**
 * @param {object[]} historyRows
 * @param {Record<EtfBenchmarkId, Record<string, number>>} benchmarks
 */
export function buildPanicLabReport(historyRows, benchmarks) {
  const intensity = buildPanicIntensitySeries(historyRows)
  const events = detectPanicEvents(historyRows, benchmarks)
  const forwardPerf = summarizePanicForwardPerformance(events, benchmarks)
  const bandStats = buildPanicBandStats(historyRows, benchmarks)
  const components = buildPanicComponentAnalysis(historyRows)

  return {
    intensity,
    events,
    forwardPerf,
    bandStats,
    components,
    eventCount: events.length,
    historyDays: intensity.series.length,
    componentPool: events.length >= 3 ? "panic80+" : "full-history",
  }
}

/** @param {number | null | undefined} v */
export function formatLabPct(v) {
  if (v == null || !Number.isFinite(v)) return "—"
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`
}
