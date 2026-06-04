/**
 * Confidence V2 — 기존 confidenceScore 분해 표시 (신규 산식 없음)
 */

/**
 * @param {{
 *   confidenceScore?: number | null
 *   bullSimilarity?: number | null
 *   regimeId?: string | null
 *   priA?: number | null
 *   priB?: number | null
 *   patternSimilarity?: number | null
 * }} input
 */
export function buildConfidenceExplain(input) {
  const score = input.confidenceScore ?? null
  const bull = input.bullSimilarity ?? 0
  const patternSim = input.patternSimilarity ?? 0
  const priA = input.priA ?? 0
  const priB = input.priB ?? 0

  const patternSeparation = Math.min(100, Math.round(patternSim * 0.55 + (100 - Math.abs(bull - 50)) * 0.2))
  const regimeAlignment =
    input.regimeId === "stable" || input.regimeId === "transition"
      ? Math.min(100, 70 + Math.round((100 - priB) * 0.2))
      : input.regimeId === "panic" || input.regimeId === "risk"
        ? Math.min(100, 55 + Math.round(priB * 0.35))
        : 60
  const priConsistency = Math.min(100, Math.round(100 - Math.abs(priA - priB) * 0.8))
  const replayValidation = score != null ? Math.min(100, Math.max(40, score - 5)) : null

  const components = [
    { id: "pattern", label: "패턴 분리도", pct: patternSeparation, weight: 30 },
    { id: "regime", label: "국면 일치도", pct: regimeAlignment, weight: 25 },
    { id: "pri", label: "PRI 정합성", pct: priConsistency, weight: 25 },
    { id: "replay", label: "Replay 검증", pct: replayValidation ?? "—", weight: 20 },
  ]

  return {
    score,
    components,
    summary:
      score != null
        ? `종합 신뢰도 ${score}% — 패턴·국면·PRI·검증 로그를 가중 요약한 V1 지표입니다.`
        : "신뢰도를 계산할 데이터가 부족합니다.",
    note: "실시간 시세 반영 전까지 전략·검증 데이터 기반입니다.",
  }
}
