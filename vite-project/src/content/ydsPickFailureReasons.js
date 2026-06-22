/**
 * 성과검증 — 실패 사례 원인 (추천 당시 잠금 스냅샷 기준)
 */

import { getRecommendSnapshot } from "./ydsValidationRecommendSnapshot.js"

/** @typedef {import("./ydsValidationStorage.js").ValidationPickRecord} ValidationPickRecord */

/** @param {string | null | undefined} grade */
function isWeakGrade(grade) {
  const g = String(grade ?? "").trim().toUpperCase()
  return g === "C" || g === "D" || g === "F"
}

/** @param {ValidationRecommendSnapshot | null | undefined} snap */
function collectSnapshotTexts(snap) {
  const parts = [
    snap?.actionGuide?.summary ?? "",
    ...(snap?.actionGuide?.items?.map((i) => i.text) ?? []),
    ...(snap?.recommendRationales?.map((r) => r.text) ?? []),
    snap?.lifecycle?.hint ?? "",
    snap?.marketStateLabel ?? "",
  ]
  return parts.join(" ")
}

/**
 * @param {ValidationPickRecord} pick
 * @returns {string[]}
 */
export function derivePickFailureReasons(pick) {
  const snap = getRecommendSnapshot(pick)
  /** @type {string[]} */
  const reasons = []

  if (snap?.lifecycle?.id === "overheat") reasons.push("과열구간")
  if (/과열/i.test(snap?.marketStateLabel ?? "")) reasons.push("과열구간")
  if (snap?.panicIntensity != null && snap.panicIntensity <= 25) reasons.push("과열구간")

  if (isWeakGrade(snap?.qualityGrade)) reasons.push("실적둔화")
  if (snap?.qualityScore != null && snap.qualityScore < 55) reasons.push("실적둔화")

  const blob = collectSnapshotTexts(snap)
  if (/60일.*이격|이격.*60|120일선 이격|이격 과다/i.test(blob)) {
    reasons.push("60일 이격과다")
  }

  if (isWeakGrade(snap?.timingGrade)) reasons.push("고평가")
  if (snap?.totalScore != null && snap.totalScore < 42) reasons.push("고평가")
  if (/고평가|밸류에이션|추격/i.test(blob)) reasons.push("고평가")

  if (isWeakGrade(snap?.marketFitGrade)) reasons.push("시장 부적합")
  if (snap?.panicIntensity != null && snap.panicIntensity >= 70) reasons.push("고패닉 구간")

  if (!reasons.length) {
    if (isWeakGrade(snap?.timingGrade)) reasons.push("타이밍 부족")
    else if (snap?.marketStateLabel && snap.marketStateLabel !== "—") {
      reasons.push(`${snap.marketStateLabel} 환경`)
    } else {
      reasons.push("추세 약화")
    }
  }

  return [...new Set(reasons)].slice(0, 3)
}
