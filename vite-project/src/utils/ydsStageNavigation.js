import { MACRO_V1_STATUS_BANDS, resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import { getStagePhilosophy } from "../content/ydsCyclePhilosophy.js"

/**
 * 현재 YDS 총점 기준 구간 · 다음 단계 · 행동 힌트
 * @param {number | null | undefined} scoreRaw
 */
export function resolveYdsStageNavigation(scoreRaw) {
  if (scoreRaw == null || !Number.isFinite(Number(scoreRaw))) return null
  const score = Math.max(0, Math.min(100, Math.round(Number(scoreRaw))))
  const currentStage = resolveMacroV1Status(score)
  if (!currentStage) return null

  const philosophy = getStagePhilosophy(currentStage.id)
  const bandIndex = MACRO_V1_STATUS_BANDS.findIndex((b) => b.id === currentStage.id)
  const nextBand =
    bandIndex >= 0 && bandIndex < MACRO_V1_STATUS_BANDS.length - 1
      ? MACRO_V1_STATUS_BANDS[bandIndex + 1]
      : null

  if (!nextBand) {
    return {
      score,
      currentStage,
      nextStage: null,
      pointsToNext: null,
      nextLine: "최고 실행 구간 — 계획대로 유지",
      actionHint: philosophy.actionGuide,
    }
  }

  const pointsToNext = Math.max(0, nextBand.min - score)
  const nextPhilosophy = getStagePhilosophy(nextBand.id)

  return {
    score,
    currentStage,
    nextStage: nextBand,
    pointsToNext,
    nextLine:
      pointsToNext === 0
        ? `${nextBand.label} 진입 임박`
        : `${nextBand.label}까지 +${pointsToNext}점`,
    actionHint: philosophy.actionGuide,
    nextActionHint: nextPhilosophy.actionGuide,
  }
}
