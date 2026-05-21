import { useMemo } from "react"
import { buildStrategyBrief } from "../utils/panicMarketReportDisplay.js"
import PanicTodayInterpretation from "./PanicTodayInterpretation.jsx"

/**
 * 패닉 V2 — 차트 하단 해석 (요약 + 상세 접기)
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
      <PanicTodayInterpretation
        panicData={panicData}
        metricKey={activeKey}
        currentValue={currentValue}
        historyRows={rows}
        deskMarketReport={deskMarketReport}
        deskMarketReportLoading={deskMarketReportLoading}
        strategyBrief={strategyBrief}
      />
    </section>
  )
}
