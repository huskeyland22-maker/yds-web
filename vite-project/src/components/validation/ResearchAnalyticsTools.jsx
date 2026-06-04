import { useMemo } from "react"
import { panicDataFromCycleRow } from "../../utils/cycleHistoryUtils.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import { buildCurrentMarketAnalysisReport } from "../../trading-zone/ydsCurrentMarketAnalysis.js"
import ConvictionEnginePanel from "../trading/ConvictionEnginePanel.jsx"
import PortfolioBuilderPanel from "../trading/PortfolioBuilderPanel.jsx"
import ResearchCategoryAccordion from "./ResearchCategoryAccordion.jsx"
import YdsPrecursorEnginePhase26Section from "./YdsPrecursorEnginePhase26Section.jsx"

/**
 * @param {{
 *   latestCycleRow?: Record<string, unknown> | null
 *   historyRows?: object[]
 * }} props
 */
export default function ResearchAnalyticsTools({
  latestCycleRow = null,
  historyRows = [],
}) {
  const latestSnapshot = useMemo(() => {
    if (!latestCycleRow) return null
    const panic = panicDataFromCycleRow(latestCycleRow)
    if (panic) return { ...latestCycleRow, ...panic, date: latestCycleRow.date ?? panic.updatedAt }
    return latestCycleRow
  }, [latestCycleRow])

  const report = useMemo(
    () =>
      buildCurrentMarketAnalysisReport(YDS_VALIDATION_EVENT_DATASET, {
        latestSnapshot,
        extraRows: historyRows,
      }),
    [latestSnapshot, historyRows],
  )

  return (
    <>
    <ResearchCategoryAccordion
      title="Stock Radar"
      description="종목 추천 · Breakdown · 추천 이유 (V2)"
    >
      <YdsPrecursorEnginePhase26Section latestCycleRow={latestCycleRow} historyRows={historyRows} />
    </ResearchCategoryAccordion>
    <ResearchCategoryAccordion
      title="포트폴리오 분석"
      description="Conviction · Portfolio Builder (시장분석 Hub에서 이동)"
    >
      <div className="research-analytics-tools">
        <h3 className="research-analytics-tools__h3">Conviction</h3>
        <ConvictionEnginePanel conviction={report.convictionEngine} compact />
        <h3 className="research-analytics-tools__h3">Portfolio Builder</h3>
        <PortfolioBuilderPanel
          sectorRadar={report.sectorRadar}
          stockRadar={report.stockRadar}
          entryRadar={report.entryRadar}
          convictionEngine={report.convictionEngine}
          actionGuide={report.actionGuide}
          compact
        />
      </div>
    </ResearchCategoryAccordion>
    </>
  )
}
