/**
 * 패닉 강도 카드 — 투자 행동 판단 (YDS 점수 기반)
 */

import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import { YDS_PANIC_RAIL_LABELS, resolvePanicBandForMacroStage } from "./ydsLanguage.js"
import { PANIC_HERO_RAIL_STAGES } from "./ydsMarketHeroRails.js"
import { resolveYdsStageNavigation } from "../utils/ydsStageNavigation.js"

/** @typedef {import("../panic-v2/panicMacroV1Status.js").MacroV1Status} MacroV1Status */

/**
 * @param {number} ydsScore
 */
export function resolvePanicActionView(ydsScore) {
  if (!Number.isFinite(ydsScore)) return null

  const rounded = Math.max(0, Math.min(100, Math.round(ydsScore)))
  const currentStage = resolveMacroV1Status(rounded)
  const nav = resolveYdsStageNavigation(rounded)
  if (!currentStage || !nav) return null

  const currentBand = resolvePanicBandForMacroStage(currentStage.id)
  const nextBand = nav.nextStage ? resolvePanicBandForMacroStage(nav.nextStage.id) : null

  const nextLine = nextBand
    ? nav.pointsToNext === 0
      ? `${nextBand.emoji} ${nextBand.label} (진입 임박)`
      : `${nextBand.emoji} ${nextBand.label} (+${nav.pointsToNext})`
    : null

  const rail = PANIC_HERO_RAIL_STAGES.map((stage) => ({
    id: stage.id,
    emoji: stage.emoji,
    label: stage.label,
    color: stage.color,
    active: currentBand?.id === stage.id,
  }))

  return {
    score: rounded,
    scoreDisplay: `${rounded} / 100`,
    currentStage,
    currentLine: `${currentBand?.emoji ?? currentStage.emoji} ${currentBand?.label ?? currentStage.label}`,
    nextLine,
    rail,
    railLegend: YDS_PANIC_RAIL_LABELS,
  }
}
