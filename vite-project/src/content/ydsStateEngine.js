/**
 * YDS V2.0 State Engine — 시장 상태 (표시·해석 전용 · 점수·엔진 무관)
 * 판정 우선순위: ① 30~60일 흐름 → ② Momentum → ③ CNN/BofA 절대값
 */

import { resolveMarketLevel } from "./ydsLevelLayer.js"
import { resolveMarketRegime } from "./ydsRegimeLayer.js"
import {
  findRowDaysBefore,
  mergeLayerHistory,
  rowDate,
  rowsWithinDays,
  toNum,
} from "./ydsLayerHistory.js"
import { resolveMomentumStatusLabel } from "./ydsStatusLabels.js"

/** @typedef {"recoveryProgress"|"optimismExpand"|"overheatUnwind"|"correction"|"panicProgress"} MarketStateId */

/**
 * @typedef {{
 *   id: MarketStateId
 *   emoji: string
 *   label: string
 *   color: string
 *   subtitles: string[]
 *   cnn: number | null
 *   bofa: number | null
 *   source: "flow" | "momentum" | "absolute"
 * }} MarketStateView
 */

export const STATE_FLOW_WINDOW_SHORT = 30
export const STATE_FLOW_WINDOW_LONG = 60

/** @type {Record<MarketStateId, { emoji: string; label: string; color: string }>} */
export const MARKET_STATE_COPY = {
  recoveryProgress: { emoji: "🟢", label: "회복 진행", color: "#22c55e" },
  optimismExpand: { emoji: "🟡", label: "낙관 확대", color: "#eab308" },
  overheatUnwind: { emoji: "🟠", label: "과열 해소 진행", color: "#f97316" },
  correction: { emoji: "🟠", label: "조정 진행 중", color: "#f97316" },
  panicProgress: { emoji: "🔴", label: "패닉 진행", color: "#ef4444" },
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
 * @param {MarketStateId} id
 * @param {{
 *   peakCnn: number | null
 *   peakBofa: number | null
 *   cnn: number | null
 *   cnnDelta30d: number | null
 *   cnnDelta3d: number | null
 *   momentumTier: string
 *   momentumLevel: string
 * }} ctx
 */
export function buildStateSubtitles(id, ctx) {
  /** @type {string[]} */
  const lines = []

  if (id === "overheatUnwind") {
    if ((ctx.peakCnn != null && ctx.peakCnn >= 60) || (ctx.peakBofa != null && ctx.peakBofa >= 6)) {
      lines.push("최근 과열권 이탈")
    }
    if (
      ctx.momentumTier === "slowdown" ||
      ctx.momentumTier === "sharpDrop" ||
      ctx.momentumTier === "riskOff" ||
      (ctx.cnnDelta3d != null && ctx.cnnDelta3d <= -10)
    ) {
      lines.push("투자심리 둔화")
    }
  } else if (id === "recoveryProgress") {
    if (ctx.cnnDelta30d != null && ctx.cnnDelta30d >= 5) lines.push("저점 대비 심리 회복")
    else lines.push("회복 국면 지속")
  } else if (id === "optimismExpand") {
    lines.push("투자심리 점진적 확대")
  } else if (id === "correction") {
    lines.push("단기 조정 흐름")
    if (ctx.momentumTier !== "calm") lines.push("투자심리 둔화")
  } else if (id === "panicProgress") {
    lines.push("급격한 위험회피")
    if (ctx.cnnDelta3d != null && ctx.cnnDelta3d <= -20) lines.push("투자심리 급락")
  }

  return lines.slice(0, 2)
}

/**
 * @param {MarketStateId} id
 * @param {object} ctx
 * @param {"flow"|"momentum"|"absolute"} source
 */
function makeState(id, ctx, source) {
  const copy = MARKET_STATE_COPY[id]
  return {
    id,
    emoji: copy.emoji,
    label: copy.label,
    color: copy.color,
    subtitles: buildStateSubtitles(id, ctx),
    cnn: ctx.cnn,
    bofa: ctx.bofa,
    source,
  }
}

/**
 * @param {import("./ydsLevelLayer.js").MarketLevelView} level
 * @param {object} ctx
 */
function stateFromAbsoluteLevel(level, ctx) {
  const map = /** @type {Record<string, MarketStateId>} */ ({
    recovery: "recoveryProgress",
    growth: "optimismExpand",
    late: "correction",
    extreme: "overheatUnwind",
  })
  const id = map[level.id] ?? "optimismExpand"
  return makeState(id, ctx, "absolute")
}

/**
 * @param {object | null | undefined} panicData
 * @param {object[]} [historyRows]
 * @param {import("./ydsMomentumLayer.js").MomentumLayerView | null | undefined} [momentum]
 * @returns {MarketStateView | null}
 */
export function resolveMarketState(panicData, historyRows = [], momentum = null) {
  const asOf = rowDate(panicData) ?? rowDate(historyRows[historyRows.length - 1])
  const merged = mergeLayerHistory(historyRows, asOf, panicData)
  if (!merged.length) return null

  const window60 = rowsWithinDays(merged, STATE_FLOW_WINDOW_LONG)
  const flowRows = window60.length ? window60 : merged
  const latest = merged[merged.length - 1]
  const cnn = toNum(latest?.fearGreed)
  const bofa = toNum(latest?.bofa)
  if (cnn == null || bofa == null) return null

  const { peakCnn, peakBofa } = peakMetrics(flowRows)
  const row30 = findRowDaysBefore(merged, STATE_FLOW_WINDOW_SHORT)
  const row60 = findRowDaysBefore(merged, STATE_FLOW_WINDOW_LONG)
  const cnn30 = toNum(row30?.fearGreed)
  const cnn60 = toNum(row60?.fearGreed)
  const cnnDelta30d = cnn30 != null ? cnn - cnn30 : null
  const cnnDelta60d = cnn60 != null ? cnn - cnn60 : null
  const cnnDropFromPeak = peakCnn != null ? peakCnn - cnn : null
  const hadOverheat = (peakCnn != null && peakCnn >= 60) || (peakBofa != null && peakBofa >= 6)

  const momentumStatus = resolveMomentumStatusLabel(momentum)
  const ctx = {
    cnn,
    bofa,
    peakCnn,
    peakBofa,
    cnnDelta30d,
    cnnDelta60d,
    cnnDropFromPeak,
    hadOverheat,
    cnnDelta3d: momentum?.cnnDelta3d ?? null,
    momentumTier: momentumStatus.tier,
    momentumLevel: momentum?.level ?? "none",
  }

  // ① 30~60일 흐름
  if (
    hadOverheat &&
    cnnDropFromPeak != null &&
    cnnDropFromPeak >= 10 &&
    cnnDelta30d != null &&
    cnnDelta30d <= -5
  ) {
    return makeState("overheatUnwind", ctx, "flow")
  }

  if (
    peakCnn != null &&
    peakCnn <= 55 &&
    cnnDelta30d != null &&
    cnnDelta30d >= 8 &&
    cnn < (peakCnn ?? cnn)
  ) {
    return makeState("recoveryProgress", ctx, "flow")
  }

  if (
    cnnDelta30d != null &&
    cnnDelta30d >= 5 &&
    !(hadOverheat && cnnDropFromPeak != null && cnnDropFromPeak >= 10)
  ) {
    return makeState("optimismExpand", ctx, "flow")
  }

  if (
    (cnnDelta30d != null && cnnDelta30d <= -8) ||
    (cnnDelta60d != null && cnnDelta60d <= -12)
  ) {
    const panicMomentum =
      momentum?.level === "strong" ||
      ctx.momentumTier === "riskOff" ||
      (ctx.cnnDelta3d != null && ctx.cnnDelta3d <= -25)
    if (!panicMomentum) {
      if (hadOverheat) return makeState("overheatUnwind", ctx, "flow")
      return makeState("correction", ctx, "flow")
    }
  }

  // ② Momentum
  if (
    momentum?.level === "strong" ||
    ctx.momentumTier === "riskOff" ||
    (ctx.cnnDelta3d != null && ctx.cnnDelta3d <= -25)
  ) {
    return makeState("panicProgress", ctx, "momentum")
  }

  if (ctx.momentumTier === "sharpDrop" || momentum?.level === "warning") {
    if (hadOverheat) return makeState("overheatUnwind", ctx, "momentum")
    if (cnnDelta30d != null && cnnDelta30d < 0) return makeState("correction", ctx, "momentum")
  }

  // ③ 절대값 fallback
  const level = resolveMarketLevel(cnn, bofa)
  if (!level) return null
  return stateFromAbsoluteLevel(level, ctx)
}

/**
 * @typedef {MarketStateView & {
 *   contextLines: string[]
 *   regimeId: import("./ydsRegimeLayer.js").MarketRegimeId | null
 * }} UnifiedMarketRegimeView
 */

/**
 * @param {import("./ydsRegimeLayer.js").MarketRegimeView | null} regime
 * @param {MarketStateView} state
 */
function regimeContextLine(regime, state) {
  if (!regime) return null
  if (regime.id === "lateCycle") return "사이클 후반 진입"
  if (regime.id === "earlyCycle") return "초기 회복 국면"
  if (regime.id === "extreme") return "극과열 구간"
  if (regime.id === "midCycle" && state.id === "optimismExpand") return null
  return null
}

/** @param {string} a @param {string} b */
function sameMeaning(a, b) {
  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true
  return false
}

/**
 * State + Regime → 단일 Market Regime (중복 문구 제거)
 * @param {object | null | undefined} panicData
 * @param {object[]} [historyRows]
 * @param {import("./ydsMomentumLayer.js").MomentumLayerView | null | undefined} [momentum]
 * @returns {UnifiedMarketRegimeView | null}
 */
export function resolveUnifiedMarketRegime(panicData, historyRows = [], momentum = null) {
  const state = resolveMarketState(panicData, historyRows, momentum)
  if (!state) return null

  const regime = resolveMarketRegime(panicData, historyRows, {
    cnnDelta3d: momentum?.cnnDelta3d ?? null,
  })

  /** @type {string[]} */
  const contextLines = []
  /** @type {Set<string>} */
  const seen = new Set()

  const add = (line) => {
    const text = String(line ?? "").trim()
    if (!text || seen.has(text)) return
    if (sameMeaning(text, state.label)) return
    for (const existing of contextLines) {
      if (sameMeaning(text, existing)) return
    }
    if (regime?.summary && sameMeaning(text, regime.summary)) return
    seen.add(text)
    contextLines.push(text)
  }

  for (const sub of state.subtitles) add(sub)

  const regimeLine = regimeContextLine(regime, state)
  if (regimeLine) add(regimeLine)

  return {
    ...state,
    contextLines,
    regimeId: regime?.id ?? null,
  }
}

/**
 * 5초 Quick Read용 — 사이클 아래 2줄 맥락 (상태 라벨 + 부제, 사이클과 중복 제거)
 * @param {string} cycleLabel
 * @param {UnifiedMarketRegimeView | null} regime
 */
export function buildQuickReadContext(cycleLabel, regime) {
  /** @type {string[]} */
  const lines = []
  if (!regime) return lines

  const add = (line) => {
    const text = String(line ?? "").trim()
    if (!text || sameMeaning(text, cycleLabel)) return
    if (lines.some((l) => sameMeaning(l, text))) return
    lines.push(text)
  }

  for (const sub of regime.subtitles) add(sub)
  add(regime.label)

  if (lines.length > 2) {
    const labelIdx = lines.findIndex((l) => sameMeaning(l, regime.label))
    if (labelIdx > 1) {
      const label = lines[labelIdx]
      const rest = lines.filter((_, i) => i !== labelIdx)
      return [rest[0], label].filter(Boolean)
    }
  }

  return lines.slice(0, 2)
}
