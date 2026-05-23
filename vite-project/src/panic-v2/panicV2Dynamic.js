/**
 * 패닉 V2 동적 — N일 변화율 → 롤링 z-score → 가중합 (히스토리 차트용)
 */
import { formatChartAxisMd } from "../utils/chartDateFormat.js"
import { sortHistoryRowsAsc } from "../utils/panicHistoryDesk.js"
import { pickPanicV2Raw } from "./computePanicV2.js"
import { PANIC_V2_DYNAMIC_METRIC_KEYS, PANIC_V2_DYNAMIC_WEIGHTS } from "./dynamicWeights.js"
import { resolvePanicV2Status } from "./panicV2Status.js"

const DEFAULT_CHANGE_LAG = 5
const DEFAULT_Z_WINDOW = 36
const MIN_WEIGHT_COVERAGE = 0.35

/** 변화율↑ = 패닉↑ 이면 false */
const INVERT_CHANGE = new Set(["fearGreed", "bofa", "gsBullBear"])

/**
 * @param {number | null} current
 * @param {number | null} past
 */
function percentChange(current, past) {
  if (current == null || past == null || !Number.isFinite(current) || !Number.isFinite(past)) {
    return null
  }
  if (past === 0) return current === 0 ? 0 : Math.sign(current) * 100
  return ((current - past) / Math.abs(past)) * 100
}

/**
 * @param {(number | null)[]} arr
 * @param {number} idx
 * @param {number} window
 */
function rollingMeanStd(arr, idx, window) {
  const start = Math.max(0, idx - window + 1)
  const slice = arr.slice(start, idx + 1).filter((v) => v != null && Number.isFinite(v))
  if (slice.length < 4) return { mean: 0, std: null }
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length
  const std = Math.sqrt(variance)
  return { mean, std: std > 1e-6 ? std : null }
}

/**
 * @param {number} z
 */
function zToContribution(z) {
  const c = Math.max(-2.5, Math.min(2.5, z))
  return 50 + c * 18
}

/**
 * @param {object[]} history
 * @param {{ changeLag?: number; zWindow?: number }} [opts]
 */
export function buildPanicV2DynamicSeries(history, opts = {}) {
  const changeLag = opts.changeLag ?? DEFAULT_CHANGE_LAG
  const zWindow = opts.zWindow ?? DEFAULT_Z_WINDOW
  const sorted = sortHistoryRowsAsc(history)
  const n = sorted.length

  /** @type {Record<string, (number | null)[]>} */
  const valueSeries = {}
  for (const key of PANIC_V2_DYNAMIC_METRIC_KEYS) {
    valueSeries[key] = sorted.map((row) => pickPanicV2Raw(row, key))
  }

  /** @type {Record<string, (number | null)[]>} */
  const changeSeries = {}
  for (const key of PANIC_V2_DYNAMIC_METRIC_KEYS) {
    const vals = valueSeries[key]
    changeSeries[key] = vals.map((cur, i) => {
      if (i < changeLag) return null
      const past = vals[i - changeLag]
      let ch = percentChange(cur, past)
      if (ch == null) return null
      if (INVERT_CHANGE.has(key)) ch = -ch
      return ch
    })
  }

  /** @type {{ date: string; score: number | null; axisLabel: string; status: string | null; statusId: string | null }[]} */
  const out = []

  for (let i = 0; i < n; i++) {
    const row = sorted[i]
    const date = String(row?.date ?? "").slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue

    let weighted = 0
    let weightUsed = 0

    for (const key of PANIC_V2_DYNAMIC_METRIC_KEYS) {
      const w = PANIC_V2_DYNAMIC_WEIGHTS[key]
      const ch = changeSeries[key][i]
      if (ch == null || !Number.isFinite(ch)) continue

      const { mean, std } = rollingMeanStd(changeSeries[key], i, zWindow)
      if (std == null) continue

      const z = (ch - mean) / std
      weighted += zToContribution(z) * w
      weightUsed += w
    }

    let score = null
    if (weightUsed >= MIN_WEIGHT_COVERAGE) {
      score = Math.round(weighted / weightUsed)
      score = Math.max(0, Math.min(100, score))
    }

    const status = resolvePanicV2Status(score)
    out.push({
      date,
      axisLabel: formatChartAxisMd(date),
      score,
      status: status?.label ?? null,
      statusId: status?.id ?? null,
    })
  }

  return out
}

/** @param {object[]} history */
export function buildPanicV2DynamicChartData(history, opts) {
  const enriched = enrichOrBuildSeries(history)
  return enriched
    .filter((p) => p.score != null)
    .map((p) => ({
      date: p.date,
      axisLabel: p.axisLabel ?? formatChartAxisMd(p.date),
      value: p.score,
      panicV2: p.score,
      panicV2Status: p.status,
    }))
}

/**
 * @param {object[]} history
 */
function enrichOrBuildSeries(history) {
  const sorted = sortHistoryRowsAsc(history)
  const hasCached = sorted.some(
    (r) => r.panicV2DynamicScore != null && Number.isFinite(Number(r.panicV2DynamicScore)),
  )
  if (hasCached) {
    return sorted.map((row) => {
      const date = String(row.date ?? "").slice(0, 10)
      const score = Number(row.panicV2DynamicScore ?? row.panicV2Score)
      if (!Number.isFinite(score)) return { date, score: null, axisLabel: formatChartAxisMd(date), status: null, statusId: null }
      const status = resolvePanicV2Status(score)
      return {
        date,
        axisLabel: formatChartAxisMd(date),
        score: Math.round(score),
        status: row.panicV2Status ?? status?.label ?? null,
        statusId: row.panicV2StatusId ?? status?.id ?? null,
      }
    })
  }
  return buildPanicV2DynamicSeries(history)
}

/** @param {object[]} history */
export function latestPanicV2DynamicScore(history, opts) {
  const series = enrichOrBuildSeries(history)
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i].score != null) return series[i].score
  }
  return null
}
