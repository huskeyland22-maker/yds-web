/**
 * YDS Score Explain Layer — 결과 → 근거 → 기울기 → 행동
 */
import { computeMarketTiming } from "./panicMarketTimingEngine.js"
import { pickMetricValue } from "./panicMarketActionEngine.js"
import {
  absoluteContributionPoints,
  BOND_AUX_KEYS,
  driversForHorizon,
  readPanicMetric,
  SCORE_BLEND,
  slopeContributionPoints,
} from "./ydsScoreExplainConfig.js"
import {
  buildSlopeSummaryLines,
  classifySlopeState,
  computeSlopeDeltas,
  formatHorizonDelta,
  slopeToneFromState,
  toneFromContribution,
} from "./ydsSlopeEngine.js"

/**
 * @typedef {{
 *   key: string
 *   title: string
 *   points: number
 *   tone: 'positive'|'neutral'|'warning'|'shock'
 *   slopeLines: string[]
 *   deltaLines: string[]
 *   warn: boolean
 *   auxiliary?: boolean
 * }} ExplainDriver
 */

/**
 * @typedef {{
 *   horizon: 'short'|'mid'|'long'
 *   label: string
 *   score: number
 *   action: string
 *   summary: string
 *   drivers: ExplainDriver[]
 * }} HorizonExplain
 */

/**
 * @typedef {{
 *   ready: boolean
 *   horizons: HorizonExplain[]
 *   bondAuxiliary: ExplainDriver[]
 *   blend: typeof SCORE_BLEND
 * }} ScoreExplainLayer
 */

/**
 * @param {object[]} rows
 * @param {string} key
 * @returns {number[]}
 */
function historyValues(rows, key) {
  if (!Array.isArray(rows) || rows.length < 2) return []
  /** @type {number[]} */
  const out = []
  for (const row of rows.slice(-24)) {
    const v = pickMetricValue(row, key)
    if (v != null) out.push(v)
  }
  return out
}

/**
 * @param {import('./ydsScoreExplainConfig.js').MetricDriverDef} def
 * @param {object | null} panicData
 * @param {object[]} historyRows
 */
function buildPanicDriver(def, panicData, historyRows) {
  const value = readPanicMetric(panicData, def.key)
  if (value == null) return null

  const absScore = def.score(value)

  const values = historyValues(historyRows, def.key)
  const deltas = computeSlopeDeltas(values.length >= 2 ? values : [value, value])
  const higherHurts = def.kind !== "fear" && def.kind !== "spread"
  const { state, warn } = classifySlopeState(def.kind, deltas, { higherHurts })
  const totalPts = absoluteContributionPoints(absScore) + slopeContributionPoints(state)

  const slopeLines = buildSlopeSummaryLines(deltas, state, { higherHurts })
  const deltaLines = formatHorizonDelta(def.key, def.kind, value, deltas)

  return {
    key: def.key,
    title: def.status(value),
    points: totalPts,
    tone: warn ? slopeToneFromState(state) : toneFromContribution(totalPts),
    slopeLines,
    deltaLines,
    warn,
  }
}

/**
 * @param {{ key: string; label: string; kind: import('./ydsScoreExplainConfig.js').SlopeKind }} def
 * @param {import('../macro-risk/engine.js').MacroRiskSnapshot | null} snapshot
 */
function buildBondAuxDriver(def, snapshot) {
  const rows = [
    ...(snapshot?.tieredMetrics?.tier1 ?? []),
    ...(snapshot?.tieredMetrics?.tier2 ?? []),
  ]
  const row = rows.find((r) => r.key === def.key)
  const current = row?.current ?? null
  if (current == null) return null

  const deltas = {
    d1: row.change1D ?? null,
    d5: row.change5D ?? null,
    d20: row.change20D ?? null,
    d1Pct: null,
    d5Pct: null,
    d20Pct: null,
  }

  const { state, warn } = classifySlopeState(def.kind, deltas, { higherHurts: true })
  let title = def.label
  if (def.key === "US10Y" && state === "shock") title = "10Y · 금리 쇼크"
  else if (def.key === "US30Y" && (state === "surge" || state === "shock")) title = "30Y · 장기채 경고"
  else if (def.key === "DXY" && state === "rise") title = "DXY · 유동성 압박"

  return {
    key: def.key,
    title,
    points: 0,
    tone: warn ? slopeToneFromState(state) : "neutral",
    slopeLines: buildSlopeSummaryLines(deltas, state, { higherHurts: true }),
    deltaLines: formatHorizonDelta(def.key, def.kind, current, deltas),
    warn,
    auxiliary: true,
  }
}

/**
 * @param {'short'|'mid'|'long'} horizon
 * @param {import('./panicMarketTimingEngine.js').TimingSignal | null} signal
 * @param {object | null} panicData
 * @param {object[]} historyRows
 */
function buildHorizonExplain(horizon, signal, panicData, historyRows) {
  const defs = driversForHorizon(horizon)
  /** @type {ExplainDriver[]} */
  const drivers = []
  for (const def of defs) {
    const d = buildPanicDriver(def, panicData, historyRows)
    if (d) drivers.push(d)
  }

  const label = signal?.label ?? (horizon === "short" ? "단기" : horizon === "mid" ? "중기" : "장기")
  const score = signal?.score ?? 0
  const action = signal?.actionShort || signal?.action || "—"

  return {
    horizon,
    label,
    score,
    action,
    summary: signal?.interpretation || signal?.marketState || "—",
    drivers,
  }
}

/**
 * @param {{
 *   panicData?: object | null
 *   snapshot?: import('../macro-risk/engine.js').MacroRiskSnapshot | null
 *   historyRows?: object[]
 * }} input
 * @returns {ScoreExplainLayer}
 */
export function buildScoreExplainLayer({
  panicData = null,
  snapshot = null,
  historyRows = [],
}) {
  if (!panicData) {
    return { ready: false, horizons: [], bondAuxiliary: [], blend: SCORE_BLEND }
  }

  const timing = computeMarketTiming(panicData)
  if (!timing) {
    return { ready: false, horizons: [], bondAuxiliary: [], blend: SCORE_BLEND }
  }

  const horizons = [
    buildHorizonExplain("short", timing.short, panicData, historyRows),
    buildHorizonExplain("mid", timing.mid, panicData, historyRows),
    buildHorizonExplain("long", timing.long, panicData, historyRows),
  ].filter((h) => h.drivers.length > 0)

  /** @type {ExplainDriver[]} */
  const bondAuxiliary = []
  for (const def of BOND_AUX_KEYS) {
    const d = buildBondAuxDriver(def, snapshot)
    if (d) bondAuxiliary.push(d)
  }

  return {
    ready: horizons.length > 0,
    horizons,
    bondAuxiliary,
    blend: SCORE_BLEND,
  }
}
