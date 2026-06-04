import { applyTerminology, resolveConfidenceLevel } from "./ydsTerminology.js"
import { buildDashboardSummaryViewModel } from "../trading-zone/ydsDashboardSummaryPresentation.js"

/**
 * @param {ReturnType<typeof import("../trading-zone/ydsCurrentMarketAnalysis.js").buildCurrentMarketAnalysisReport>} report
 */
export function buildInterpretationReasons(report) {
  /** @type {string[]} */
  const reasons = []
  const env = report.marketEnvironment
  const risk = report.currentState?.risk

  if (env?.dominantPattern?.label) {
    reasons.push(`위험 패턴 ${env.dominantPattern.label} 유사 ${env.dominantPattern.similarity ?? "—"}%`)
  }
  if (risk?.priA != null) {
    reasons.push(`조기경보 ${risk.priA} · ${risk.priALabel ?? "—"}`)
  }
  if (risk?.priB != null) {
    reasons.push(`충격감지 ${risk.priB} · ${risk.priBLabel ?? "—"}`)
  }
  if (env?.marketCondition?.precursorLabel) {
    reasons.push(`시장 국면 · ${env.marketCondition.precursorLabel}`)
  } else if (env?.marketCondition?.label) {
    reasons.push(`시장 환경 · ${env.marketCondition.label}`)
  }
  if (reasons.length < 3 && report.headline?.interpretation) {
    reasons.push(applyTerminology(report.headline.interpretation))
  }
  return reasons.slice(0, 3)
}

/**
 * @param {ReturnType<typeof import("../trading-zone/ydsCurrentMarketAnalysis.js").buildCurrentMarketAnalysisReport>} report
 */
export function buildMarketHubTopViewModel(report) {
  const summary = buildDashboardSummaryViewModel({
    actionStageHero: report.actionStageHero,
    actionGuide: report.actionGuide,
    marketEnvironment: report.marketEnvironment,
    sectorRadar: report.sectorRadar,
    entryRadar: report.entryRadar,
    portfolio: report.portfolio,
  })

  const confidence = resolveConfidenceLevel(report.marketEnvironment?.confidenceScore)
  const interpretationLine = applyTerminology(
    report.actionGuide?.oneLiner || report.headline?.interpretation || "—",
  )

  return {
    available: summary.available,
    confidence,
    confidenceScore: report.marketEnvironment?.confidenceScore ?? null,
    interpretationLine,
    interpretationReasons: buildInterpretationReasons(report),
    stage: report.actionStageHero,
    marketPosition: {
      display: report.marketEnvironment?.ydsDisplay ?? report.currentState?.yds?.display ?? "—",
      whyLines: [
        `시장 위치 점수 ${report.marketEnvironment?.ydsDisplay ?? "—"}`,
        report.currentState?.regime?.label
          ? `시장 국면 ${report.currentState.regime.label}`
          : null,
        report.marketEnvironment?.dominantPattern?.label
          ? `위험 패턴 ${report.marketEnvironment.dominantPattern.label}`
          : null,
      ].filter(Boolean),
    },
    recommendedAction: applyTerminology(summary.recommendedAction),
    actionWhyLines: [
      report.actionGuide?.current?.label
        ? `현재 단계 · ${report.actionGuide.current.label}`
        : null,
      report.portfolio?.description ?? report.portfolio?.allocation?.stockLabel ?? null,
    ].filter(Boolean),
    topSectors: summary.topSectors,
    topStocks: (report.stockRadar?.topBuys ?? []).slice(0, 5),
    stockRadarMeta: {
      confidenceLabel: report.stockRadar?.topBuys?.[0]?.explain?.confidence?.label ?? "전략 기반",
      weightsDisplay: report.stockRadar?.scoreWeightsDisplay ?? null,
    },
    allocation: summary.allocation,
    hasSectors: summary.hasSectors,
    hasStocks: (report.stockRadar?.topBuys ?? []).length > 0,
  }
}
