import PanicMarketActionPanel from "./PanicMarketActionPanel.jsx"
import PanicMarketReportPanel from "./PanicMarketReportPanel.jsx"
import PanicMetricInsightPanel from "./PanicMetricInsightPanel.jsx"

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

  return (
    <section
      className={["trading-card-shell panic-v2-section panic-desk-stack overflow-visible", className]
        .filter(Boolean)
        .join(" ")}
    >
      <PanicMetricInsightPanel
        metricKey={activeKey}
        currentValue={currentValue}
        historyRows={rows}
        panicData={panicData}
      />
      <PanicMarketActionPanel panicData={panicData} />
      <PanicMarketReportPanel
        report={deskMarketReport}
        loading={deskMarketReportLoading}
        panicData={panicData}
      />
    </section>
  )
}
