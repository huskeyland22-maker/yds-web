/**
 * 패닉 V2 동적 점수 — panic_index_history / cycle row 시계열
 */
import { resolvePanicV2Status } from "./panicV2Status.js"

const PANIC_V2_DYNAMIC_WEIGHTS = {
  vix: 0.15,
  vvix: 0.1,
  vixTerm: 0.15,
  putCall: 0.2,
  ndxDistance: 0.15,
  soxxDistance: 0.1,
  dxy: 0.1,
  move: 0.05,
}

const PANIC_V2_DYNAMIC_METRIC_KEYS = Object.keys(PANIC_V2_DYNAMIC_WEIGHTS)
const INVERT_CHANGE = new Set(["ndxDistance", "soxxDistance"])
const DEFAULT_CHANGE_LAG = 5
const DEFAULT_Z_WINDOW = 36
const MIN_WEIGHT_COVERAGE = 0.35

function toNum(v) {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** @param {object | null | undefined} data @param {string} key */
export function pickPanicV2Raw(data, key) {
  if (!data || typeof data !== "object") return null
  switch (key) {
    case "vixTerm":
      return toNum(data.vixTerm ?? data.vix_term)
    case "ndxDistance":
      return toNum(data.ndxDistance ?? data.ndx_distance)
    case "soxxDistance":
      return toNum(data.soxxDistance ?? data.soxx_distance)
    case "vvix":
      return toNum(data.vvix)
    case "dxy":
      return toNum(data.dxy)
    case "highYield":
      return toNum(data.highYield ?? data.hyOas ?? data.hy_oas ?? data.hy)
    case "gsBullBear":
      return toNum(data.gsBullBear ?? data.gsSentiment ?? data.gs_sentiment ?? data.gs)
    default:
      return toNum(data[key])
  }
}

function percentChange(current, past) {
  if (current == null || past == null || !Number.isFinite(current) || !Number.isFinite(past)) {
    return null
  }
  if (past === 0) return current === 0 ? 0 : Math.sign(current) * 100
  return ((current - past) / Math.abs(past)) * 100
}

function rollingMeanStd(arr, idx, window) {
  const start = Math.max(0, idx - window + 1)
  const slice = arr.slice(start, idx + 1).filter((v) => v != null && Number.isFinite(v))
  if (slice.length < 4) return { mean: 0, std: null }
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length
  const std = Math.sqrt(variance)
  return { mean, std: std > 1e-6 ? std : null }
}

function zToContribution(z) {
  const c = Math.max(-2.5, Math.min(2.5, z))
  return 50 + c * 18
}

function sortAsc(rows) {
  return [...rows].sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

/**
 * @param {object[]} history
 * @param {{ changeLag?: number; zWindow?: number }} [opts]
 */
export function buildPanicV2DynamicSeries(history, opts = {}) {
  const changeLag = opts.changeLag ?? DEFAULT_CHANGE_LAG
  const zWindow = opts.zWindow ?? DEFAULT_Z_WINDOW
  const sorted = sortAsc(history)
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

  /** @type {{ date: string; score: number | null; status: string | null; statusId: string | null }[]} */
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
      score,
      status: status?.label ?? null,
      statusId: status?.id ?? null,
    })
  }

  return out
}

/** @param {object[]} history */
export function latestPanicV2DynamicScore(history) {
  const series = buildPanicV2DynamicSeries(history)
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i].score != null) return series[i].score
  }
  return null
}
