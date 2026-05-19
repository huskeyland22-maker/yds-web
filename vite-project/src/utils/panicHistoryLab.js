/**
 * 패닉 히스토리 랩 — panic_index_history → 정규화 시리즈 + 복합 패닉지수
 */

import { formatChartAxisMd } from "./chartDateFormat.js"
import { HISTORY_SECTION_METRICS } from "./panicDeskMetrics.js"
import { sortHistoryRowsAsc } from "./panicHistoryDesk.js"
import {
  getFinalScore,
  scoreBofa,
  scoreFearGreed,
  scoreHY,
  scorePutCall,
  scoreVIX,
} from "./tradingScores.js"

export const LAB_METRICS = HISTORY_SECTION_METRICS

/** @typedef {{ id: string; label: string; min: number; max: number; color: string }} PanicStageBand */

export const PANIC_STAGE_BANDS = [
  { id: "extreme_fear", label: "극도 공포", min: 80, max: 100, color: "#ef4444" },
  { id: "fear", label: "공포", min: 60, max: 80, color: "#f97316" },
  { id: "neutral", label: "중립", min: 40, max: 60, color: "#94a3b8" },
  { id: "optimism", label: "낙관", min: 20, max: 40, color: "#38bdf8" },
  { id: "overheat", label: "과열", min: 0, max: 20, color: "#a78bfa" },
]

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function normalizedFear(v, lo, hi, reverse = false) {
  const n = toNum(v)
  if (n == null) return null
  const base = ((n - lo) / (hi - lo)) * 100
  const scaled = clamp(base, 0, 100)
  return reverse ? 100 - scaled : scaled
}

/** 지표별 0~100 공포 점수 (높을수록 공포·스트레스) */
export function metricFearScore(key, value) {
  const v = toNum(value)
  if (v == null) return null
  switch (key) {
    case "vix":
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
      return normalizedFear(v, 80, 140, false)
    case "skew":
      return normalizedFear(v, 125, 165, false)
    case "gsBullBear":
      return normalizedFear(v, 0, 1, true)
    default:
      return null
  }
}

/** 복합 패닉지수 0~100 (getFinalScore) */
export function compositePanicScore(row) {
  if (!row || typeof row !== "object") return null
  const data = {
    vix: toNum(row.vix),
    putCall: toNum(row.putCall),
    fearGreed: toNum(row.fearGreed),
    bofa: toNum(row.bofa),
    highYield: toNum(row.highYield ?? row.hyOas),
  }
  if (data.vix == null && data.fearGreed == null) return null
  return getFinalScore(data)
}

/**
 * @param {number | null} score 0~100 fear
 */
export function resolvePanicMarketStage(score) {
  const s = toNum(score)
  if (s == null) {
    return { id: "unknown", label: "—", color: "#64748b" }
  }
  if (s >= 80) return PANIC_STAGE_BANDS[0]
  if (s >= 60) return PANIC_STAGE_BANDS[1]
  if (s >= 40) return PANIC_STAGE_BANDS[2]
  if (s >= 20) return PANIC_STAGE_BANDS[3]
  return PANIC_STAGE_BANDS[4]
}

function rowRaw(row, key) {
  if (key === "highYield") return toNum(row.highYield ?? row.hyOas)
  return toNum(row[key])
}

function pctChange(curr, prev) {
  if (curr == null || prev == null || prev === 0) return null
  return ((curr - prev) / Math.abs(prev)) * 100
}

/**
 * @param {object[]} cycleRows
 */
export function buildPanicLabChartData(cycleRows) {
  if (!Array.isArray(cycleRows) || cycleRows.length === 0) return []

  const sorted = sortHistoryRowsAsc(cycleRows)

  return sorted.map((row, index) => {
    const prevRow = index > 0 ? sorted[index - 1] : row
    const date = String(row.date ?? row.ts ?? "").slice(0, 10)
    const composite = compositePanicScore(row)
    const prevComposite = index > 0 ? compositePanicScore(prevRow) : composite
    const stage = resolvePanicMarketStage(composite)

    /** @type {Record<string, unknown>} */
    const point = {
      date,
      axisLabel: formatChartAxisMd(date),
      composite,
      stageId: stage.id,
      stageLabel: stage.label,
      stageColor: stage.color,
    }

    for (const m of LAB_METRICS) {
      const raw = rowRaw(row, m.key)
      const norm = metricFearScore(m.key, raw)
      if (norm != null && Number.isNaN(norm)) continue

      const prevRawVal = index > 0 ? rowRaw(prevRow, m.key) : raw
      const prevNormVal =
        index > 0 ? metricFearScore(m.key, prevRawVal) : norm

      point[`${m.key}Raw`] = raw
      point[`${m.key}N`] = norm
      point[`${m.key}Chg`] = pctChange(raw, prevRawVal ?? null)

      if (norm != null && prevNormVal != null && !Number.isNaN(norm) && !Number.isNaN(prevNormVal)) {
        point[`${m.key}Delta`] = norm - prevNormVal
      }
    }

    point.compositeChg = pctChange(composite, prevComposite)

    return point
  })
}

/** @param {ReturnType<typeof buildPanicLabChartData>} data */
export function latestLabSnapshot(data) {
  if (!data?.length) return null
  return data[data.length - 1]
}
