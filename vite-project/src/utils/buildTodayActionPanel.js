/**
 * 전술 HUD — 단·중·장·실전 카드 데이터
 */
import { buildDailyMarketReport } from "./buildDailyMarketReport.js"
import { buildRecommendationEngine } from "./buildRecommendationEngine.js"
import { buildScoreExplainLayer } from "./buildScoreExplainLayer.js"
import { PANIC_TACTICAL_CARD_ACTIONS_COMPACT } from "./panicTacticalCardCopy.js"
import { buildTacticalScoreBottomLine } from "./tacticalScoreInterpretation.js"

/**
 * @typedef {{
 *   id: import("./tacticalScoreInterpretation.js").TacticalCardHorizonId
 *   period: string
 *   action: string
 *   score: number | null
 *   scoreLine: string | null
 *   scoreArrow: string | null
 *   scoreHint: string | null
 *   scoreBand: import("./tacticalScoreInterpretation.js").TacticalScoreBandId | null
 * }} TacticalCard
 */

/**
 * @typedef {{
 *   ready: boolean
 *   tacticalCards: TacticalCard[]
 *   explainLayer: import("./buildScoreExplainLayer.js").ScoreExplainLayer
 * }} TodayActionPanelModel
 */

/**
 * @param {{ short: string; mid: string; long: string; tactical: string }} practical
 * @param {import("./buildScoreExplainLayer.js").HorizonExplain[]} horizons
 * @returns {TacticalCard[]}
 */
function withScoreInterpretation(cardId, period, action, score) {
  const bottom = buildTacticalScoreBottomLine(cardId, score)
  return {
    id: cardId,
    period,
    action,
    score: bottom?.score ?? (Number.isFinite(Number(score)) ? Math.round(Number(score)) : null),
    scoreLine: bottom?.line ?? null,
    scoreArrow: bottom?.arrow ?? null,
    scoreHint: bottom?.hint ?? null,
    scoreBand: bottom?.band ?? null,
  }
}

function buildTacticalCards(_practical, horizons) {
  const scoreByHorizon = Object.fromEntries(horizons.map((h) => [h.horizon, h.score]))
  const a = PANIC_TACTICAL_CARD_ACTIONS_COMPACT
  const tacticalScore = scoreByHorizon.mid ?? scoreByHorizon.short ?? null

  return [
    withScoreInterpretation("short", "단기", a.short, scoreByHorizon.short),
    withScoreInterpretation("mid", "중기", a.mid, scoreByHorizon.mid),
    withScoreInterpretation("long", "장기", a.long, scoreByHorizon.long),
    withScoreInterpretation("tactical", "실전", a.tactical, tacticalScore),
  ]
}

/**
 * @param {{
 *   panicData?: object | null
 *   cycleScore?: number | null
 *   snapshot?: import("../macro-risk/engine.js").MacroRiskSnapshot | null
 *   historyRows?: object[]
 * }} input
 * @returns {TodayActionPanelModel}
 */
export function buildTodayActionPanel({
  panicData = null,
  cycleScore = null,
  snapshot = null,
  historyRows = [],
}) {
  const report = buildDailyMarketReport({ panicData, cycleScore, snapshot })
  const rec = buildRecommendationEngine({ panicData, cycleScore, snapshot })
  const explainLayer = buildScoreExplainLayer({ panicData, snapshot, historyRows, cycleScore })

  const ready = rec.ready && explainLayer.ready

  if (!ready) {
    return {
      ready: false,
      tacticalCards: [],
      explainLayer,
    }
  }

  return {
    ready: true,
    tacticalCards: buildTacticalCards(rec.practical, explainLayer.horizons),
    explainLayer,
  }
}
