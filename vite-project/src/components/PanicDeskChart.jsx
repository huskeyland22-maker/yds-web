import { useMemo } from "react"
import { buildStrategyBrief } from "../utils/panicMarketReportDisplay.js"
import { buildMarketPolicy } from "../trading-zone/marketPolicyEngine.js"
import PanicTodayInterpretation from "./PanicTodayInterpretation.jsx"

/**
 * 패닉 데스크 하단 — 상세 브리핑 접기만 (오늘 해석 제거)
 * @param {{
 *   panicData?: object | null
 *   deskMarketReport?: object | null
 *   deskMarketReportLoading?: boolean
 *   className?: string
 * }} props
 */
export default function PanicDeskChart({
  className = "",
  panicData = null,
  deskMarketReport = null,
  deskMarketReportLoading = false,
}) {
  const strategyBrief = useMemo(() => {
    if (deskMarketReportLoading || !deskMarketReport?.summary) return ""
    return buildStrategyBrief(deskMarketReport, panicData)
  }, [deskMarketReport, deskMarketReportLoading, panicData])
  const marketPolicy = useMemo(
    () => buildMarketPolicy({ panicData, panicStage: deskMarketReport?.regimeLabel ?? null }),
    [panicData, deskMarketReport],
  )

  const hasFooter =
    Boolean(strategyBrief?.trim()) ||
    Boolean(deskMarketReport?.summary) ||
    deskMarketReportLoading

  if (!hasFooter) return null

  return (
    <section
      className={[
        "trading-card-shell panic-v2-section panic-desk-report-block overflow-x-hidden overflow-y-visible mt-4",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <PanicTodayInterpretation
        deskMarketReport={deskMarketReport}
        deskMarketReportLoading={deskMarketReportLoading}
        strategyBrief={strategyBrief}
        marketPolicy={marketPolicy}
      />
    </section>
  )
}
