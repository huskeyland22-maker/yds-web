/**
 * 전술 HUD 4카드 점수 디버그 — 콘솔 출력
 */
import { buildTacticalHudTimingScoreDebug } from "./panicMarketTimingEngine.js"

/**
 * @param {{
 *   panicData?: object | null
 *   horizons?: { horizon: string; score: number }[]
 *   tacticalCards?: { id: string; period: string; score: number | null }[]
 * }} ctx
 */
export function logTacticalHudScoreDebug({ panicData = null, horizons = [], tacticalCards = [] }) {
  const timing = buildTacticalHudTimingScoreDebug(panicData)

  const horizonScores = Object.fromEntries(horizons.map((h) => [h.horizon, h.score]))
  const cardScores = Object.fromEntries(tacticalCards.map((c) => [c.id, c.score]))

  const payload = {
    rawShortScore: timing.rawShortScore,
    rawMidScore: timing.rawMidScore,
    rawLongScore: timing.rawLongScore,
    rawWatchScore: timing.rawWatchScore,
    rawTacticalScore: timing.rawTacticalScore,
    source: timing.source,
    normalization: timing.normalization,
    clamp: timing.clamp,
    tacticalReuse: timing.tacticalReuse,
    explainLayerHorizonScores: horizonScores,
    cardDisplayedScores: cardScores,
    computeMarketTimingScores: timing.computeMarketTimingScores,
    matchCheck: {
      debugVsExplainShort:
        timing.rawShortScore != null && horizonScores.short != null
          ? timing.rawShortScore === horizonScores.short
          : null,
      debugVsExplainMid:
        timing.rawMidScore != null && horizonScores.mid != null
          ? timing.rawMidScore === horizonScores.mid
          : null,
      debugVsExplainLong:
        timing.rawLongScore != null && horizonScores.long != null
          ? timing.rawLongScore === horizonScores.long
          : null,
      cardTacticalVsRawTactical:
        cardScores.tactical != null && timing.rawTacticalScore != null
          ? cardScores.tactical === timing.rawTacticalScore
          : null,
    },
  }

  console.log("[TACTICAL HUD SCORE]", payload)
  return payload
}
