/**
 * YDS 역사 검증관 — 공통 데이터 타입·빌더
 * @typedef {"panic" | "dca" | "interest" | "overheated"} YdsEventCategory
 * @typedef {"skeleton" | "complete"} YdsEventCompletionStatus
 * @typedef {"start" | "rise" | "fearExpansion" | "climax" | "recovery"} ReplayMilestoneKey
 */
import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import { getFinalScore } from "../utils/tradingScores.js"

/** @type {ReplayMilestoneKey[]} */
export const YDS_MILESTONE_ORDER = ["start", "rise", "fearExpansion", "climax", "recovery"]

export const YDS_MILESTONE_STEP_LABEL = {
  start: "시작",
  rise: "상승",
  fearExpansion: "공포확대",
  climax: "극점",
  recovery: "회복",
}

/**
 * @typedef {Object} MilestoneIndicatorData
 * @property {string} date
 * @property {number | null} yds
 * @property {number | null} vix
 * @property {number | null} cnn
 * @property {number | null} bofa
 * @property {number | null} highYield
 * @property {number | null} putCall
 * @property {number | null} sp500
 */

/**
 * @typedef {Object} ReplayMilestone
 * @property {string} date
 * @property {MilestoneIndicatorData} historyData
 */

/**
 * @typedef {Object} MarketMetrics
 * @property {number | null} maxDrawdownPct
 * @property {number | null} after6mSp500Pct
 * @property {number | null} after12mSp500Pct
 * @property {string | null} performanceAnchorDate
 */

/**
 * @typedef {Object} EventDetailData
 * @property {string} id
 * @property {YdsEventCategory} category
 * @property {string} name
 * @property {string} startDate
 * @property {string} endDate
 * @property {{ start: string; rally: string; fearExpansion: string; extreme: string; recovery: string }} keyDates
 * @property {YdsEventCategory} phase
 * @property {string} event
 * @property {Record<ReplayMilestoneKey, ReplayMilestone>} milestones
 * @property {MarketMetrics} marketPerformance
 * @property {number | null} durationDays
 * @property {YdsEventCompletionStatus} [completionStatus]
 * @property {string | null} [performanceNotes]
 */

/**
 * @typedef {Object} EventCompletionPayload
 * @property {YdsEventCompletionStatus} completionStatus
 * @property {string} [performanceNotes]
 * @property {Partial<MarketMetrics>} marketPerformance
 * @property {Partial<Record<ReplayMilestoneKey, { historyData?: Partial<Pick<MilestoneIndicatorData, "yds" | "vix" | "cnn" | "bofa" | "highYield" | "putCall" | "sp500">> }>>} [milestones]
 */

/** @param {string} date */
export function buildHistoryData(date) {
  return {
    date,
    yds: null,
    vix: null,
    cnn: null,
    bofa: null,
    highYield: null,
    putCall: null,
    sp500: null,
  }
}

/** @param {Partial<MarketMetrics>} [patch] @returns {MarketMetrics} */
export function buildMarketMetrics(patch = {}) {
  return {
    maxDrawdownPct: null,
    after6mSp500Pct: null,
    after12mSp500Pct: null,
    performanceAnchorDate: null,
    ...patch,
  }
}

/**
 * @param {string} date
 * @param {Partial<MilestoneIndicatorData>} [indicatorPatch]
 * @returns {ReplayMilestone}
 */
export function buildReplayMilestone(date, indicatorPatch = {}) {
  return {
    date,
    historyData: {
      ...buildHistoryData(date),
      ...indicatorPatch,
    },
  }
}

/**
 * @param {{ start: string; rally: string; fearExpansion: string; extreme: string; recovery: string }} keyDates
 * @returns {Record<ReplayMilestoneKey, ReplayMilestone>}
 */
export function buildMilestonesFromKeyDates(keyDates) {
  return {
    start: buildReplayMilestone(keyDates.start),
    rise: buildReplayMilestone(keyDates.rally),
    fearExpansion: buildReplayMilestone(keyDates.fearExpansion),
    climax: buildReplayMilestone(keyDates.extreme),
    recovery: buildReplayMilestone(keyDates.recovery),
  }
}

/** @param {string} date */
function toMs(date) {
  const ms = new Date(`${date}T12:00:00`).getTime()
  return Number.isFinite(ms) ? ms : NaN
}

/**
 * @param {{ start: string; rally: string; fearExpansion: string; extreme: string; recovery: string }} keyDates
 * @returns {{ valid: boolean; orderedDates: string[]; violations: string[] }}
 */
export function validateMilestoneOrder(keyDates) {
  const keys = ["start", "rally", "fearExpansion", "extreme", "recovery"]
  const labels = ["start", "rise", "fearExpansion", "climax", "recovery"]
  const orderedDates = keys.map((k) => keyDates[k])
  const violations = []

  for (let i = 1; i < orderedDates.length; i += 1) {
    const prev = toMs(orderedDates[i - 1])
    const cur = toMs(orderedDates[i])
    if (!Number.isFinite(prev) || !Number.isFinite(cur)) {
      violations.push(`${labels[i - 1]} ↔ ${labels[i]}: invalid date`)
      continue
    }
    if (cur <= prev) {
      violations.push(`${labels[i - 1]}(${orderedDates[i - 1]}) must be before ${labels[i]}(${orderedDates[i]})`)
    }
  }

  return { valid: violations.length === 0, orderedDates, violations }
}

/**
 * @param {Partial<EventCompletionPayload>} payload
 * @returns {EventCompletionPayload}
 */
export function createEventCompletion(payload) {
  return {
    completionStatus: payload.completionStatus ?? "complete",
    performanceNotes: payload.performanceNotes,
    marketPerformance: payload.marketPerformance ?? buildMarketMetrics(),
    milestones: payload.milestones,
  }
}

export function formatPct(value) {
  if (value == null || !Number.isFinite(value)) return "—"
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(1)}%`
}

export function formatMetric(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—"
  return Number(value).toFixed(digits)
}

function toFiniteOrNull(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function canComputeYds(historyData) {
  if (!historyData || typeof historyData !== "object") return false
  const vix = toFiniteOrNull(historyData.vix)
  const fearGreed = toFiniteOrNull(historyData.cnn)
  const bofa = toFiniteOrNull(historyData.bofa)
  const putCall = toFiniteOrNull(historyData.putCall)
  const highYield = toFiniteOrNull(historyData.highYield)
  return [vix, fearGreed, bofa, putCall, highYield].every((v) => v != null)
}

export function computeYdsScore(historyData) {
  if (!canComputeYds(historyData)) return null
  const score = getFinalScore({
    vix: Number(historyData.vix),
    fearGreed: Number(historyData.cnn),
    bofa: Number(historyData.bofa),
    putCall: Number(historyData.putCall),
    highYield: Number(historyData.highYield),
  })
  return Number.isFinite(score) ? Math.round(score) : null
}

export function resolveYdsStage(score) {
  const stage = resolveMacroV1Status(score)
  return stage
    ? { id: stage.id, label: stage.label, emoji: stage.emoji }
    : null
}
