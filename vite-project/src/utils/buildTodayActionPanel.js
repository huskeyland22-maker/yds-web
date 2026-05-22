/**
 * TODAY ACTION PANEL — HUD 데이터 (시장요약 중복 최소화)
 */
import { buildBondReferenceDisplay } from "../market-os/bondLiquidityReference.js"
import { resolveCycleZone } from "./cycleZoneLabels.js"
import { buildDailyMarketReport } from "./buildDailyMarketReport.js"
import { buildRecommendationEngine } from "./buildRecommendationEngine.js"
import { buildScoreExplainLayer } from "./buildScoreExplainLayer.js"
import { compactPhrase, uniquePhrases } from "./dailyReportCopy.js"

/** @typedef {"risk" | "transition" | "floor" | "neutral"} ZoneHudTone */

/**
 * @typedef {{
 *   id: string
 *   period: string
 *   action: string
 *   score: number | null
 *   horizon: import("./buildScoreExplainLayer.js").HorizonExplain | null
 * }} TacticalCard
 */

/**
 * @typedef {{
 *   ready: boolean
 *   zoneLabel: string
 *   zoneTone: ZoneHudTone
 *   riskGauge: number | null
 *   riskBlocks: number
 *   todayLines: string[]
 *   badges: string[]
 *   tacticalCards: TacticalCard[]
 *   explainLayer: import("./buildScoreExplainLayer.js").ScoreExplainLayer
 * }} TodayActionPanelModel
 */

/** @param {import("./cycleZoneLabels.js").CycleZoneId | null} zone */
export function resolveZoneHudTone(zone) {
  if (zone === "peak" || zone === "high") return "risk"
  if (zone === "transition") return "transition"
  if (zone === "floor" || zone === "low") return "floor"
  return "neutral"
}

/** @param {number | null | undefined} cycleScore @returns {{ gauge: number | null; blocks: number }} */
export function resolveRiskGauge(cycleScore) {
  if (!Number.isFinite(Number(cycleScore))) return { gauge: null, blocks: 0 }
  const gauge = Math.max(0, Math.min(100, Math.round(100 - Number(cycleScore))))
  const blocks = Math.max(0, Math.min(6, Math.round((gauge / 100) * 6)))
  return { gauge, blocks }
}

/**
 * @param {import("./buildDailyMarketReport.js").DailyMarketReport} report
 * @param {{ short: string }} periods
 */
function buildTodayLines(report, periods) {
  return uniquePhrases(
    [
      compactPhrase(report.actionToday.today),
      compactPhrase(periods.short),
      report.actionToday.cash ? `현금 ${report.actionToday.cash}` : null,
    ],
    3,
  )
}

/**
 * @param {import("./buildScoreExplainLayer.js").HorizonExplain[]} horizons
 * @param {string[]} bondStatuses
 */
function buildContextBadges(horizons, bondStatuses) {
  /** @type {string[]} */
  const out = []
  const short = horizons.find((h) => h.horizon === "short")
  if (short) {
    for (const d of short.drivers.filter((x) => !x.auxiliary).slice(0, 2)) {
      const badge = `${d.metricLabel} ${d.statusShort}`.trim()
      if (badge && !out.includes(badge)) out.push(badge)
    }
  }

  for (const label of bondStatuses) {
    const short =
      label === "장기채 경고"
        ? "채권 경고"
        : label === "유동성 주의" || label === "유동성 축소"
          ? "유동성 주의"
          : label
    if (short && !out.includes(short)) out.push(short)
    if (out.length >= 4) break
  }

  return out.slice(0, 4)
}

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
      horizon: horizons.find((h) => h.horizon === "short") ?? null,
    },
    {
      id: "mid",
      period: "중기",
      action: compactPhrase(practical.mid).replace(/\s+/g, ""),
      score: scoreByHorizon.mid ?? null,
      horizon: horizons.find((h) => h.horizon === "mid") ?? null,
    },
    {
      id: "long",
      period: "장기",
      action: compactPhrase(practical.long).replace(/\s+/g, ""),
      score: scoreByHorizon.long ?? null,
      horizon: horizons.find((h) => h.horizon === "long") ?? null,
    },
    {
      id: "tactical",
      period: "실전",
      action: compactPhrase(practical.tactical).replace(/\s+/g, ""),
      score: scoreByHorizon.mid ?? scoreByHorizon.short ?? null,
      horizon: null,
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
  const zone = resolveCycleZone(cycleScore)
  const report = buildDailyMarketReport({ panicData, cycleScore, snapshot })
  const rec = buildRecommendationEngine({ panicData, cycleScore, snapshot })
  const explainLayer = buildScoreExplainLayer({ panicData, snapshot, historyRows, cycleScore })
  const bondRef = buildBondReferenceDisplay(snapshot)

  const ready = rec.ready && explainLayer.ready

  if (!ready) {
    return {
      ready: false,
      zoneLabel: zone.zoneLabel,
      zoneTone: resolveZoneHudTone(zone.zone),
      riskGauge: null,
      riskBlocks: 0,
      todayLines: [],
      badges: [],
      tacticalCards: [],
      explainLayer,
    }
  }

  const { gauge, blocks } = resolveRiskGauge(cycleScore)

  return {
    ready: true,
    zoneLabel: zone.zoneLabel,
    zoneTone: resolveZoneHudTone(zone.zone),
    riskGauge: gauge,
    riskBlocks: blocks,
    todayLines: buildTodayLines(report, rec.practical),
    badges: buildContextBadges(explainLayer.horizons, bondRef.statusLabels),
    tacticalCards: buildTacticalCards(rec.practical, explainLayer.horizons),
    explainLayer,
  }
}
