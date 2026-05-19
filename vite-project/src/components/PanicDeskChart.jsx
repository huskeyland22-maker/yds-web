import { useMemo } from "react"
import PanicMarketActionPanel from "./PanicMarketActionPanel.jsx"
import PanicMarketReportPanel from "./PanicMarketReportPanel.jsx"
import PanicMetricInsightPanel from "./PanicMetricInsightPanel.jsx"
import SectionErrorBoundary from "./SectionErrorBoundary.jsx"
import { buildStrategyBrief } from "../utils/panicMarketReportDisplay.js"

/**
 * 패닉 V2 — 차트는 PanicUnifiedHistorySection 단일 사용 (중복 제거)
 * @param {{
 *   rows: object[]
 *   primarySeries: { key: string; name: string; color?: string }
 *   chartMetric: string
 *   className?: string
 *   panicData?: object | null
 *   deskMarketReport?: object | null
 *   deskMarketReportLoading?: boolean
 * }} props
 */
export default function PanicDeskChart({
  chartMetric,
  className = "",
  panicData = null,
  rows = [],
  deskMarketReport = null,
  deskMarketReportLoading = false,
}) {
  const activeKey = chartMetric || "vix"
  const currentValue = panicData?.[activeKey]

  const strategyBrief = useMemo(() => {
    if (deskMarketReportLoading || !deskMarketReport?.summary) return ""
    return buildStrategyBrief(deskMarketReport, panicData)
  }, [deskMarketReport, deskMarketReportLoading, panicData])

  return (
    <section
      className={[
        "trading-card-shell panic-v2-section panic-desk-report-block overflow-x-hidden overflow-y-visible",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <PanicMetricInsightPanel
        metricKey={activeKey}
        currentValue={currentValue}
        historyRows={rows}
        panicData={panicData}
      />
      <SectionErrorBoundary label="시장 액션">
        <PanicMarketActionPanel panicData={panicData} strategyBrief={strategyBrief} />
      </SectionErrorBoundary>
      <SectionErrorBoundary label="시장 리포트">
        <PanicMarketReportPanel
          report={deskMarketReport}
          loading={deskMarketReportLoading}
          panicData={panicData}
        />
      </SectionErrorBoundary>
    </section>
  )
}
