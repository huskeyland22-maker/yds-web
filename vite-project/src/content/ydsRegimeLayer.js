/**
 * YDS V2.0 Regime Layer — 최근 30~90일 시장 국면 (표시 전용 · 점수·엔진 무관)
 * 절대값(Level)과 분리: CNN 42 상승 vs 급락 후 42를 다르게 해석
 */

import { resolveMarketLevel } from "./ydsLevelLayer.js"
import { mergeLayerHistory, rowDate, rowsWithinDays, toNum } from "./ydsLayerHistory.js"

/** @typedef {"earlyCycle"|"midCycle"|"lateCycle"|"extreme"} MarketRegimeId */

/**
 * @typedef {{
 *   id: MarketRegimeId
 *   emoji: string
 *   label: string
 *   color: string
 *   summary: string
 *   windowDays: number
 *   peakCnn: number | null
 *   peakBofa: number | null
 *   cnn: number | null
 *   bofa: number | null
 * }} MarketRegimeView
 */

export const REGIME_WINDOW_DAYS = 90

/** @type {Record<MarketRegimeId, { emoji: string; label: string; color: string }>} */
export const REGIME_TIER_COPY = {
  earlyCycle: { emoji: "🟢", label: "초기 회복", color: "#22c55e" },
  midCycle: { emoji: "🟡", label: "중기 성장", color: "#eab308" },
  lateCycle: { emoji: "🟠", label: "후기 사이클", color: "#f97316" },
  extreme: { emoji: "🔴", label: "최고 과열", color: "#ef4444" },
}

/**
 * @param {object[]} windowRows
 */
function peakMetrics(windowRows) {
  let peakCnn = null
  let peakBofa = null
  for (const row of windowRows) {
    const cnn = toNum(row.fearGreed)
    const bofa = toNum(row.bofa)
    if (cnn != null) peakCnn = peakCnn == null ? cnn : Math.max(peakCnn, cnn)
    if (bofa != null) peakBofa = peakBofa == null ? bofa : Math.max(peakBofa, bofa)
  }
  return { peakCnn, peakBofa }
}

/**
 * @param {MarketRegimeId} id
 * @param {{
 *   cnn: number | null
 *   bofa: number | null
 *   peakCnn: number | null
 *   peakBofa: number | null
 *   cnnDelta3d: number | null
 * }} ctx
 */
export function resolveRegimeSummary(id, ctx) {
  const { cnn, peakCnn, cnnDelta3d } = ctx

  if (id === "extreme") {
    return "극단 과열 · 현금·수익 관리 최우선"
  }
  if (id === "lateCycle") {
    const cooling =
      (peakCnn != null && cnn != null && peakCnn - cnn >= 8) ||
      (cnnDelta3d != null && cnnDelta3d <= -10)
    if (cooling) return "최근 과열권 해소 진행"
    return "과열권 잔류 · 수익 관리 유지"
  }
  if (id === "midCycle") {
    return "중기 성장 국면 · 추격 자제"
  }
  return "초기 회복 국면 유지"
}

/**
 * @param {object | null | undefined} panicData
 * @param {object[]} [historyRows]
 * @param {{ cnnDelta3d?: number | null; windowDays?: number }} [opts]
 */
export function resolveMarketRegime(panicData, historyRows = [], opts = {}) {
  const windowDays = opts.windowDays ?? REGIME_WINDOW_DAYS
  const asOf = rowDate(panicData) ?? rowDate(historyRows[historyRows.length - 1])
  const merged = mergeLayerHistory(historyRows, asOf, panicData)
  if (!merged.length) return null

  const windowRows = rowsWithinDays(merged, windowDays)
  const latest = merged[merged.length - 1]
  const cnn = toNum(latest?.fearGreed)
  const bofa = toNum(latest?.bofa)
  if (cnn == null || bofa == null) return null

  const { peakCnn, peakBofa } = peakMetrics(windowRows.length ? windowRows : merged)

  /** @type {MarketRegimeId} */
  let id = "midCycle"

  if ((cnn >= 80 && bofa >= 8) || (peakCnn != null && peakCnn >= 80 && peakBofa != null && peakBofa >= 8)) {
    id = "extreme"
  } else if (peakCnn != null && peakCnn >= 70) {
    id = "lateCycle"
  } else if (peakBofa != null && peakBofa >= 6) {
    id = "lateCycle"
  } else if (
    peakCnn != null &&
    peakCnn <= 50 &&
    peakBofa != null &&
    peakBofa <= 5 &&
    cnn <= 50 &&
    bofa <= 5
  ) {
    id = "earlyCycle"
  } else if (cnn >= 50 && cnn <= 70 && bofa >= 5 && bofa <= 7) {
    id = "midCycle"
  } else if (peakCnn != null && peakCnn <= 50 && peakBofa != null && peakBofa <= 5) {
    id = "earlyCycle"
  }

  const copy = REGIME_TIER_COPY[id]
  const summary = resolveRegimeSummary(id, {
    cnn,
    bofa,
    peakCnn,
    peakBofa,
    cnnDelta3d: opts.cnnDelta3d ?? null,
  })

  return {
    id,
    emoji: copy.emoji,
    label: copy.label,
    color: copy.color,
    summary,
    windowDays,
    peakCnn,
    peakBofa,
    cnn,
    bofa,
  }
}

/**
 * @param {object | null | undefined} panicData
 * @param {object[]} [historyRows]
 * @param {import("./ydsMomentumLayer.js").MomentumLayerView | null | undefined} [momentum]
 */
export function resolveMarketLevelRegime(panicData, historyRows = [], momentum = null) {
  const asOf = rowDate(panicData) ?? rowDate(historyRows[historyRows.length - 1])
  const merged = mergeLayerHistory(historyRows, asOf, panicData)
  const latest = merged[merged.length - 1] ?? panicData

  const level = resolveMarketLevel(latest?.fearGreed, latest?.bofa)
  const regime = resolveMarketRegime(panicData, historyRows, {
    cnnDelta3d: momentum?.cnnDelta3d ?? null,
  })

  return { level, regime }
}
