/**
 * 전술 HUD — 단·중·장·실전 카드 데이터
 */
import { buildDailyMarketReport } from "./buildDailyMarketReport.js"
import { buildRecommendationEngine } from "./buildRecommendationEngine.js"
import { buildScoreExplainLayer } from "./buildScoreExplainLayer.js"
import { compactPhrase } from "./dailyReportCopy.js"

/**
 * @typedef {{
 *   id: string
 *   period: string
 *   action: string
 *   score: number | null
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
function buildTacticalCards(practical, horizons) {
  const scoreByHorizon = Object.fromEntries(horizons.map((h) => [h.horizon, h.score]))

  return [
    {
      id: "short",
      period: "단기",
      action: compactPhrase(practical.short).replace(/\s+/g, ""),
      score: scoreByHorizon.short ?? null,
    },
    {
      id: "mid",
      period: "중기",
      action: compactPhrase(practical.mid).replace(/\s+/g, ""),
      score: scoreByHorizon.mid ?? null,
    },
    {
      id: "long",
      period: "장기",
      action: compactPhrase(practical.long).replace(/\s+/g, ""),
      score: scoreByHorizon.long ?? null,
    },
    {
      id: "tactical",
      period: "실전",
      action: compactPhrase(practical.tactical).replace(/\s+/g, ""),
      score: scoreByHorizon.mid ?? scoreByHorizon.short ?? null,
    },
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
