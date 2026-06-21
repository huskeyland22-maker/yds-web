/**
 * 성과검증 7일 데이터 신뢰도 — 저장값·재계산·판정 일치 검증
 */

import { calcRecommendReturnPct } from "../trading-zone/tradingZoneRecommendationTrack.js"
import {
  classifyPickOutcome,
  DEFAULT_OUTCOME_CRITERIA,
  picksWithLockedOutcome,
  resolvePickOutcomeView,
} from "./ydsPickOutcomeEngine.js"
import { getRecommendSnapshot } from "./ydsValidationRecommendSnapshot.js"

/** @typedef {import("./ydsValidationStorage.js").ValidationPickRecord} ValidationPickRecord */

export const RELIABILITY_HORIZON = "d7"
export const RELIABILITY_SAMPLE_SIZE = 10
const RETURN_TOLERANCE = 0.05

/** @param {number | null | undefined} v */
export function roundReturnPct(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 10) / 10
}

/**
 * @param {number | null} calc
 * @param {number | null} stored
 */
export function returnsMatch(calc, stored) {
  if (calc == null || stored == null) return false
  return Math.abs(calc - stored) <= RETURN_TOLERANCE
}

/**
 * @param {ValidationPickRecord} pick
 * @returns {{
 *   recommendPrice: number | null
 *   priceD7: number | null
 *   calcReturn: number | null
 *   systemReturn: number | null
 *   returnMatch: boolean
 *   outcomeCalc: import("./ydsPickOutcomeEngine.js").OutcomeId | null
 *   outcomeSystem: import("./ydsPickOutcomeEngine.js").OutcomeId | null
 *   outcomeMatch: boolean
 *   priceOk: boolean
 *   trusted: boolean
 * }}
 */
export function auditPickD7Reliability(pick) {
  const snap = getRecommendSnapshot(pick)
  const recommendPrice =
    pick.recommendedPrice != null && pick.recommendedPrice > 0
      ? pick.recommendedPrice
      : snap?.recommendedPrice != null && snap.recommendedPrice > 0
        ? snap.recommendedPrice
        : null

  const priceD7 =
    pick.horizonPrices?.d7 != null && Number.isFinite(pick.horizonPrices.d7)
      ? Number(pick.horizonPrices.d7)
      : null

  const rawCalc =
    recommendPrice != null && priceD7 != null
      ? calcRecommendReturnPct(recommendPrice, priceD7)
      : null
  const calcReturn = roundReturnPct(rawCalc)
  const systemReturn =
    pick.horizons?.d7 != null && Number.isFinite(pick.horizons.d7)
      ? Number(pick.horizons.d7)
      : null

  const returnMatch = returnsMatch(calcReturn, systemReturn)
  const outcomeCalc = classifyPickOutcome(calcReturn, DEFAULT_OUTCOME_CRITERIA)
  const outcomeSystem = classifyPickOutcome(systemReturn, DEFAULT_OUTCOME_CRITERIA)
  const outcomeMatch = outcomeCalc === outcomeSystem
  const priceOk =
    recommendPrice != null &&
    recommendPrice > 0 &&
    priceD7 != null &&
    priceD7 > 0

  return {
    recommendPrice,
    priceD7,
    calcReturn,
    systemReturn,
    returnMatch,
    outcomeCalc,
    outcomeSystem,
    outcomeMatch,
    priceOk,
    trusted: priceOk && returnMatch && outcomeMatch,
  }
}

/**
 * @typedef {{
 *   id: string
 *   ticker: string
 *   name: string
 *   recommendedAt: string
 *   recommendPrice: number | null
 *   priceD7: number | null
 *   calcReturn: number | null
 *   systemReturn: number | null
 *   returnMatch: boolean
 *   outcomeLabel: string
 *   outcomeMatch: boolean
 *   trusted: boolean
 * }} ReliabilitySampleRow
 */

/**
 * @typedef {{
 *   horizonKey: 'd7'
 *   horizonLabel: string
 *   totalWithD7: number
 *   priceOkCount: number
 *   returnMatchCount: number
 *   outcomeMatchCount: number
 *   trustedCount: number
 *   trustPct: number | null
 *   samples: ReliabilitySampleRow[]
 *   mismatches: ReliabilitySampleRow[]
 * }} ReliabilityAuditReport
 */

/**
 * @param {ValidationPickRecord} pick
 */
function toSampleRow(pick) {
  const audit = auditPickD7Reliability(pick)
  const view = resolvePickOutcomeView(audit.systemReturn, DEFAULT_OUTCOME_CRITERIA)
  return /** @type {ReliabilitySampleRow} */ ({
    id: pick.id,
    ticker: pick.ticker,
    name: pick.name,
    recommendedAt: pick.recommendedAt,
    recommendPrice: audit.recommendPrice,
    priceD7: audit.priceD7,
    calcReturn: audit.calcReturn,
    systemReturn: audit.systemReturn,
    returnMatch: audit.returnMatch,
    outcomeLabel: view?.label ?? "—",
    outcomeMatch: audit.outcomeMatch,
    trusted: audit.trusted,
  })
}

/**
 * @param {ValidationPickRecord[]} allPicks
 * @param {number} [sampleSize]
 * @returns {ReliabilityAuditReport}
 */
export function buildReliabilityAuditReport(allPicks, sampleSize = RELIABILITY_SAMPLE_SIZE) {
  const withD7 = picksWithLockedOutcome(allPicks ?? [], RELIABILITY_HORIZON)
  const rows = withD7.map(toSampleRow)

  let priceOkCount = 0
  let returnMatchCount = 0
  let outcomeMatchCount = 0
  let trustedCount = 0

  for (const pick of withD7) {
    const a = auditPickD7Reliability(pick)
    if (a.priceOk) priceOkCount += 1
    if (a.returnMatch) returnMatchCount += 1
    if (a.outcomeMatch) outcomeMatchCount += 1
    if (a.trusted) trustedCount += 1
  }

  const sorted = [...rows].sort((a, b) => b.recommendedAt.localeCompare(a.recommendedAt))
  const mismatches = sorted.filter((r) => !r.trusted)
  const samples = sorted.slice(0, sampleSize)

  const total = withD7.length
  const trustPct = total > 0 ? Math.round((trustedCount / total) * 1000) / 10 : null

  return {
    horizonKey: "d7",
    horizonLabel: "7일",
    totalWithD7: total,
    priceOkCount,
    returnMatchCount,
    outcomeMatchCount,
    trustedCount,
    trustPct,
    samples,
    mismatches,
  }
}
