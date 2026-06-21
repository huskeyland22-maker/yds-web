/**
 * YDS 성과검증 — 성공/보통/실패 판정 (잠금 수익률만 · 설정값 관리)
 */

import { PERF_HORIZONS } from "./ydsPickPerformanceEngine.js"

/** @typedef {import("./ydsValidationStorage.js").ValidationPickRecord} ValidationPickRecord */
/** @typedef {'d7' | 'd14' | 'd30'} OutcomeHorizonKey */
/** @typedef {'success' | 'normal' | 'failure'} OutcomeId */

/**
 * @typedef {{
 *   successMinPct: number
 *   failureMaxPct: number
 * }} OutcomeCriteria
 */

/** @type {OutcomeCriteria} */
export const DEFAULT_OUTCOME_CRITERIA = {
  successMinPct: 10,
  failureMaxPct: 0,
}

/** @type {Record<OutcomeId, { id: OutcomeId; emoji: string; label: string; tone: string }>} */
export const OUTCOME_VIEWS = {
  success: { id: "success", emoji: "🟢", label: "성공", tone: "success" },
  normal: { id: "normal", emoji: "🟡", label: "보통", tone: "normal" },
  failure: { id: "failure", emoji: "🔴", label: "실패", tone: "failure" },
}

/** @param {OutcomeCriteria} [criteria] */
export function outcomeCriteriaLabels(criteria = DEFAULT_OUTCOME_CRITERIA) {
  const s = criteria.successMinPct
  const f = criteria.failureMaxPct
  return [
    { id: "success", label: `성공 (+${s}%↑)` },
    { id: "normal", label: `보통 (${f}~${s}%)` },
    { id: "failure", label: `실패 (${f}%↓)` },
  ]
}

/**
 * @param {number | null | undefined} returnPct
 * @param {OutcomeCriteria} [criteria]
 * @returns {OutcomeId | null}
 */
export function classifyPickOutcome(returnPct, criteria = DEFAULT_OUTCOME_CRITERIA) {
  if (returnPct == null || !Number.isFinite(returnPct)) return null
  if (returnPct >= criteria.successMinPct) return "success"
  if (returnPct > criteria.failureMaxPct) return "normal"
  return "failure"
}

/** @param {OutcomeId | null | undefined} outcomeId */
export function resolveOutcomeView(outcomeId) {
  if (!outcomeId) return null
  return OUTCOME_VIEWS[outcomeId] ?? null
}

/** @param {number | null | undefined} returnPct @param {OutcomeCriteria} [criteria] */
export function resolvePickOutcomeView(returnPct, criteria = DEFAULT_OUTCOME_CRITERIA) {
  return resolveOutcomeView(classifyPickOutcome(returnPct, criteria))
}

/** @param {ValidationPickRecord[]} picks @param {OutcomeHorizonKey} horizonKey */
export function picksWithLockedOutcome(picks, horizonKey) {
  return (picks ?? []).filter((p) => {
    const ret = p.horizons?.[horizonKey]
    return ret != null && Number.isFinite(ret)
  })
}

/**
 * @typedef {{
 *   horizonKey: OutcomeHorizonKey
 *   horizonLabel: string
 *   criteria: OutcomeCriteria
 *   total: number
 *   successCount: number
 *   normalCount: number
 *   failureCount: number
 *   successRate: number | null
 *   avgReturn: number | null
 * }} OutcomeSummaryReport
 */

/**
 * @param {ValidationPickRecord[]} allPicks
 * @param {OutcomeHorizonKey} [horizonKey]
 * @param {OutcomeCriteria} [criteria]
 * @returns {OutcomeSummaryReport}
 */
export function buildOutcomeSummaryReport(
  allPicks,
  horizonKey = "d30",
  criteria = DEFAULT_OUTCOME_CRITERIA,
) {
  const rows = picksWithLockedOutcome(allPicks, horizonKey)
  let successCount = 0
  let normalCount = 0
  let failureCount = 0
  let sum = 0

  for (const p of rows) {
    const ret = Number(p.horizons[horizonKey])
    sum += ret
    const outcome = classifyPickOutcome(ret, criteria)
    if (outcome === "success") successCount += 1
    else if (outcome === "normal") normalCount += 1
    else if (outcome === "failure") failureCount += 1
  }

  const total = rows.length
  const successRate =
    total > 0 ? Math.round((successCount / total) * 1000) / 10 : null
  const avgReturn =
    total > 0 ? Math.round((sum / total) * 10) / 10 : null

  return {
    horizonKey,
    horizonLabel: PERF_HORIZONS.find((h) => h.key === horizonKey)?.label ?? horizonKey,
    criteria: { ...criteria },
    total,
    successCount,
    normalCount,
    failureCount,
    successRate,
    avgReturn,
  }
}

/** @param {OutcomeHorizonKey} horizonKey @param {ValidationPickRecord} pick @param {OutcomeCriteria} [criteria] */
export function pickHorizonOutcome(pick, horizonKey, criteria = DEFAULT_OUTCOME_CRITERIA) {
  const ret = pick.horizons?.[horizonKey]
  const returnPct = ret != null && Number.isFinite(ret) ? Number(ret) : null
  return {
    returnPct,
    outcomeId: classifyPickOutcome(returnPct, criteria),
    view: resolvePickOutcomeView(returnPct, criteria),
  }
}
