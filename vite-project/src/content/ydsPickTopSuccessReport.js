/**
 * 성과검증 — TOP 성공 사례 리포트 (7일 잠금 · 저장 스냅샷만)
 */

import {
  classifyPickOutcome,
  DEFAULT_OUTCOME_CRITERIA,
  picksWithLockedOutcome,
} from "./ydsPickOutcomeEngine.js"
import { getPickPatternGrade } from "./ydsPickPatternGrades.js"
import { getRecommendSnapshot } from "./ydsValidationRecommendSnapshot.js"

/** @typedef {import("./ydsValidationStorage.js").ValidationPickRecord} ValidationPickRecord */

const HORIZON_KEY = "d7"
const CASE_LIMIT = 5

/**
 * @typedef {{
 *   id: string
 *   name: string
 *   ticker: string
 *   recommendedAt: string
 *   recommendedPrice: number | null
 *   returnPct: number
 *   totalScore: number | null
 *   qualityGrade: string | null
 *   timingGrade: string | null
 *   marketFitGrade: string | null
 *   panicIntensity: number | null
 * }} TopSuccessCase
 */

/**
 * @typedef {{
 *   visible: boolean
 *   horizonLabel: string
 *   cases: TopSuccessCase[]
 *   commonTraits: string[]
 *   successCount: number
 * }} TopSuccessReport
 */

/** @param {ValidationPickRecord} pick @param {number} returnPct */
function buildCaseRow(pick, returnPct) {
  const snap = getRecommendSnapshot(pick)
  return {
    id: pick.id,
    name: pick.name,
    ticker: pick.ticker,
    recommendedAt: pick.recommendedAt,
    recommendedPrice: snap?.recommendedPrice ?? pick.recommendedPrice ?? null,
    returnPct,
    totalScore:
      snap?.totalScore != null && Number.isFinite(snap.totalScore)
        ? Math.round(snap.totalScore)
        : pick.recommendedScore != null && Number.isFinite(pick.recommendedScore)
          ? Math.round(pick.recommendedScore)
          : null,
    qualityGrade: getPickPatternGrade(pick, "quality"),
    timingGrade: getPickPatternGrade(pick, "timing"),
    marketFitGrade: getPickPatternGrade(pick, "marketFit"),
    panicIntensity:
      snap?.panicIntensity != null && Number.isFinite(snap.panicIntensity)
        ? Math.round(snap.panicIntensity)
        : null,
  }
}

/** @param {TopSuccessCase[]} cases */
function deriveCommonTraits(cases) {
  const n = cases.length
  if (!n) return []

  /** @type {string[]} */
  const traits = []

  const share = (pred) => cases.filter(pred).length / n

  if (share((c) => c.marketFitGrade === "A") >= 0.5) {
    traits.push("시장적합 A 비중 높음")
  }

  if (share((c) => c.qualityGrade === "A" || c.qualityGrade === "B") >= 0.5) {
    traits.push("품질 A/B 집중")
  }

  if (
    share(
      (c) =>
        c.panicIntensity != null && c.panicIntensity >= 20 && c.panicIntensity <= 40,
    ) >= 0.4
  ) {
    traits.push("패닉 20~40 구간 우세")
  }

  if (
    share(
      (c) => c.totalScore != null && c.totalScore >= 45 && c.totalScore <= 55,
    ) >= 0.4
  ) {
    traits.push("총점 45~55 구간 다수")
  }

  if (share((c) => c.timingGrade === "A") >= 0.5) {
    traits.push("타이밍 A 등급 비중 높음")
  }

  if (share((c) => c.qualityGrade === "A") >= 0.5) {
    traits.push("품질 A 등급 비중 높음")
  }

  return [...new Set(traits)].slice(0, 5)
}

/**
 * @param {ValidationPickRecord[]} picks
 * @returns {TopSuccessReport}
 */
export function buildTopSuccessReport(picks) {
  const locked = picksWithLockedOutcome(picks ?? [], HORIZON_KEY)
  const successRows = locked
    .map((pick) => {
      const returnPct = Number(pick.horizons[HORIZON_KEY])
      return {
        pick,
        returnPct,
        outcome: classifyPickOutcome(returnPct, DEFAULT_OUTCOME_CRITERIA),
      }
    })
    .filter((row) => row.outcome === "success")
    .sort((a, b) => b.returnPct - a.returnPct)

  if (!successRows.length) {
    return {
      visible: false,
      horizonLabel: "7일",
      cases: [],
      commonTraits: [],
      successCount: 0,
    }
  }

  /** @type {Set<string>} */
  const seenTickers = new Set()
  const uniqueRows = []
  for (const row of successRows) {
    const key = String(row.pick.ticker ?? "").trim().toUpperCase()
    if (!key || seenTickers.has(key)) continue
    seenTickers.add(key)
    uniqueRows.push(row)
    if (uniqueRows.length >= CASE_LIMIT) break
  }

  const cases = uniqueRows.map((row) => buildCaseRow(row.pick, row.returnPct))

  return {
    visible: true,
    horizonLabel: "7일",
    cases,
    commonTraits: deriveCommonTraits(cases),
    successCount: successRows.length,
  }
}
