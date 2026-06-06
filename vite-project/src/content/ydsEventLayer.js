/**
 * Event Layer V1.3 — 최근 시장 변화 (표시 전용 · 점수·가중치 무관)
 * State = 현재 위치 · Action = 오늘 행동 · Event = 최근 발생한 변화
 */

import { getFinalScore } from "../utils/tradingScores.js"
import { mergeLayerHistory, rowDate, rowsWithinDays, toNum } from "./ydsLayerHistory.js"

/** @typedef {"none"|"exit"|"entry"|"panicEntry"} EventLevel */

/**
 * @typedef {{
 *   id: string
 *   kind: "exit"|"entry"|"panicEntry"
 *   metric: "cnn"|"bofa"|"yds"
 *   level: EventLevel
 *   title: string
 *   summary: string
 *   peak?: number
 *   current?: number
 *   prior?: number
 * }} MarketEvent
 */

/**
 * @typedef {{
 *   hasEvents: boolean
 *   level: EventLevel
 *   events: MarketEvent[]
 *   headline: string
 * }} EventLayerView
 */

export const EVENT_RULES = {
  cnn: {
    field: "fearGreed",
    metric: "cnn",
    lookbackDays: 21,
    exitPeakMin: 70,
    exitCurrentMax: 60,
    entryPriorMax: 60,
    entryCurrentMin: 70,
  },
  bofa: {
    field: "bofa",
    metric: "bofa",
    lookbackDays: 28,
    exitPeakMin: 7,
    exitCurrentMax: 6,
    entryPriorMax: null,
    entryCurrentMin: null,
  },
  yds: {
    lookbackDays: 28,
    dcaMin: 60,
    lifePointMin: 80,
  },
}

/** @param {EventLevel} a @param {EventLevel} b */
function maxEventLevel(a, b) {
  const rank = { none: 0, exit: 1, entry: 2, panicEntry: 3 }
  return rank[a] >= rank[b] ? a : b
}

/**
 * @param {object[]} sorted
 * @param {typeof EVENT_RULES.cnn} rule
 */
function detectCnnExit(sorted, rule) {
  const latest = sorted[sorted.length - 1]
  const current = toNum(latest?.[rule.field])
  if (current == null || current >= rule.exitCurrentMax) return null

  const windowRows = rowsWithinDays(sorted, rule.lookbackDays)
  let peak = null
  for (const row of windowRows) {
    const v = toNum(row[rule.field])
    if (v != null) peak = peak == null ? v : Math.max(peak, v)
  }
  if (peak == null || peak < rule.exitPeakMin) return null

  return {
    id: "cnn-exit",
    kind: "exit",
    metric: "cnn",
    level: "exit",
    title: "CNN 과열권 이탈",
    summary: "낙관 심리가 빠르게 약화되고 있습니다.",
    peak,
    current,
  }
}

/**
 * @param {object[]} sorted
 * @param {typeof EVENT_RULES.cnn} rule
 */
function detectCnnEntry(sorted, rule) {
  const latest = sorted[sorted.length - 1]
  const current = toNum(latest?.[rule.field])
  if (current == null || current < rule.entryCurrentMin) return null

  const windowRows = rowsWithinDays(sorted, rule.lookbackDays)
  let priorMin = null
  for (const row of windowRows) {
    const v = toNum(row[rule.field])
    if (v != null) priorMin = priorMin == null ? v : Math.min(priorMin, v)
  }
  if (priorMin == null || priorMin > rule.entryPriorMax) return null

  return {
    id: "cnn-entry",
    kind: "entry",
    metric: "cnn",
    level: "entry",
    title: "CNN 과열권 진입",
    summary: "시장 낙관 심리가 확대되고 있습니다.",
    prior: priorMin,
    current,
  }
}

/**
 * @param {object[]} sorted
 * @param {typeof EVENT_RULES.bofa} rule
 */
function detectBofaExit(sorted, rule) {
  const latest = sorted[sorted.length - 1]
  const current = toNum(latest?.[rule.field])
  if (current == null || current >= rule.exitCurrentMax) return null

  const windowRows = rowsWithinDays(sorted, rule.lookbackDays)
  let peak = null
  for (const row of windowRows) {
    const v = toNum(row[rule.field])
    if (v != null) peak = peak == null ? v : Math.max(peak, v)
  }
  if (peak == null || peak < rule.exitPeakMin) return null

  return {
    id: "bofa-exit",
    kind: "exit",
    metric: "bofa",
    level: "exit",
    title: "BofA 과열권 이탈",
    summary: "과열 신호가 완화되고 있습니다.",
    peak,
    current,
  }
}

/** @param {object | null | undefined} row */
function rowYdsScore(row) {
  if (!row || typeof row !== "object") return null
  const score = getFinalScore(row)
  return Number.isFinite(score) ? Math.round(score) : null
}

/**
 * @param {object[]} sorted
 * @param {typeof EVENT_RULES.yds} rule
 * @param {object | null | undefined} panicData
 */
function detectPanicZoneEntry(sorted, rule, panicData) {
  const asOf = rowDate(panicData)
  const current = rowYdsScore(panicData)
  if (current == null) return null

  const windowRows = rowsWithinDays(sorted, rule.lookbackDays)
  /** @type {number[]} */
  const scores = []
  for (const row of windowRows) {
    const s = asOf && row.date === asOf ? current : rowYdsScore(row)
    if (s != null) scores.push(s)
  }
  if (!scores.length) return null

  if (current >= rule.lifePointMin) {
    const hadBelow = scores.some((s) => s < rule.lifePointMin)
    if (hadBelow) {
      return {
        id: "yds-life-entry",
        kind: "panicEntry",
        metric: "yds",
        level: "panicEntry",
        title: "인생 타점 진입",
        summary: "극단적 공포 구간에 진입했습니다.",
        prior: Math.min(...scores),
        current,
      }
    }
  }

  if (current >= rule.dcaMin) {
    const hadBelow = scores.some((s) => s < rule.dcaMin)
    if (hadBelow) {
      return {
        id: "yds-dca-entry",
        kind: "panicEntry",
        metric: "yds",
        level: "panicEntry",
        title: "분할매수 단계 진입",
        summary: "공포가 확대되며 매수 구간에 진입했습니다.",
        prior: Math.min(...scores),
        current,
      }
    }
  }

  return null
}

/** @param {MarketEvent[]} events */
function sortEvents(events) {
  const levelRank = { panicEntry: 3, exit: 2, entry: 1 }
  return [...events].sort((a, b) => levelRank[b.level] - levelRank[a.level])
}

/**
 * @param {object | null | undefined} panicData
 * @param {object[]} [historyRows]
 */
export function resolveEventLayer(panicData, historyRows = []) {
  const asOf = rowDate(panicData) ?? rowDate(historyRows[historyRows.length - 1])
  const merged = mergeLayerHistory(historyRows, asOf, panicData)

  if (!merged.length) {
    return /** @type {EventLayerView} */ ({
      hasEvents: false,
      level: "none",
      events: [],
      headline: "",
    })
  }

  /** @type {MarketEvent[]} */
  const events = []

  const cnnExit = detectCnnExit(merged, EVENT_RULES.cnn)
  const cnnEntry = detectCnnEntry(merged, EVENT_RULES.cnn)
  if (cnnExit) events.push(cnnExit)
  else if (cnnEntry) events.push(cnnEntry)

  const bofaExit = detectBofaExit(merged, EVENT_RULES.bofa)
  if (bofaExit) events.push(bofaExit)

  const panicEntry = detectPanicZoneEntry(merged, EVENT_RULES.yds, panicData)
  if (panicEntry) events.push(panicEntry)

  const sorted = sortEvents(events)

  let level = /** @type {EventLevel} */ ("none")
  for (const ev of sorted) {
    level = maxEventLevel(level, ev.level)
  }

  const headline = sorted.length ? sorted.map((e) => e.title).join(" · ") : ""

  return {
    hasEvents: sorted.length > 0,
    level,
    events: sorted,
    headline,
  }
}
