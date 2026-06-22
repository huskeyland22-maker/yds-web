/**
 * 성과검증 — TOP 실패 사례 리포트 (7일 잠금 · 저장 스냅샷만)
 */

import {
  classifyPickOutcome,
  DEFAULT_OUTCOME_CRITERIA,
  picksWithLockedOutcome,
} from "./ydsPickOutcomeEngine.js"
import { getPickPatternGrade } from "./ydsPickPatternGrades.js"
import { derivePickFailureReasons } from "./ydsPickFailureReasons.js"
import { getRecommendSnapshot } from "./ydsValidationRecommendSnapshot.js"

const HORIZON_KEY = "d7"
const CASE_LIMIT = 5

/** @param {import("./ydsValidationStorage.js").ValidationPickRecord} pick @param {number} returnPct */
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
    marketStateLabel: snap?.marketStateLabel ?? pick.regimeLabel ?? "—",
    panicIntensity:
      snap?.panicIntensity != null && Number.isFinite(snap.panicIntensity)
        ? Math.round(snap.panicIntensity)
        : null,
    failureReasons: derivePickFailureReasons(pick),
  }
}

/** @param {ReturnType<typeof buildCaseRow>[]} cases */
function deriveCommonTraits(cases) {
  const n = cases.length
  if (!n) return []

  const traits = []
  const share = (pred) => cases.filter(pred).length / n

  if (share((c) => c.timingGrade === "C") >= 0.4) {
    traits.push("타이밍 C 비중 높음")
  }

  if (share((c) => c.totalScore != null && c.totalScore <= 40) >= 0.4) {
    traits.push("총점 40 이하 집중")
  }

  if (share((c) => c.qualityGrade === "B" || c.qualityGrade === "C") >= 0.5) {
    traits.push("품질 B/C 비중 높음")
  }

  const stateCounts = new Map()
  for (const row of cases) {
    const key = row.marketStateLabel
    if (!key || key === "—") continue
    stateCounts.set(key, (stateCounts.get(key) ?? 0) + 1)
  }
  const dominantState = [...stateCounts.entries()].sort((a, b) => b[1] - a[1])[0]
  if (dominantState && dominantState[1] / n >= 0.4) {
    traits.push(`${dominantState[0]} 상태에서 성과 부진`)
  }

  if (share((c) => c.panicIntensity != null && c.panicIntensity >= 60) >= 0.4) {
    traits.push("패닉 고강도 구간 비중 높음")
  }

  return [...new Set(traits)].slice(0, 5)
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord[]} picks
 */
export function buildTopFailureReport(picks) {
  const locked = picksWithLockedOutcome(picks ?? [], HORIZON_KEY)
  const failureRows = locked
    .map((pick) => {
      const returnPct = Number(pick.horizons[HORIZON_KEY])
      return {
        pick,
        returnPct,
        outcome: classifyPickOutcome(returnPct, DEFAULT_OUTCOME_CRITERIA),
      }
    })
    .filter((row) => row.outcome === "failure")
    .sort((a, b) => a.returnPct - b.returnPct)

  if (!failureRows.length) {
    return {
      visible: false,
      horizonLabel: "7일",
      cases: [],
      commonTraits: [],
      failureCount: 0,
    }
  }

  /** @type {Set<string>} */
  const seenTickers = new Set()
  const uniqueRows = []
  for (const row of failureRows) {
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
    failureCount: failureRows.length,
  }
}
