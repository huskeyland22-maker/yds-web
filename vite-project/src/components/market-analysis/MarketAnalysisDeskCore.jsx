import { useMemo } from "react"
import { buildAiReportMarketStatus } from "../../utils/buildAiReportMarketStatus.js"
import AiReportMarketStatusBlock from "../AiReportMarketStatusBlock.jsx"
import CycleBondLiquiditySection from "../cycle/CycleBondLiquiditySection.jsx"
import CycleDataBasisBar from "../cycle/CycleDataBasisBar.jsx"
import HomeV5DeskLead from "../../home-v5/HomeV5DeskLead.jsx"
import { isMacroRiskEnabled } from "../../macro-risk/featureFlag.js"
import { useMacroRiskSnapshot } from "../../macro-risk/useMacroRiskSnapshot.js"
import PanicIndexHistorySection from "../PanicIndexHistorySection.jsx"
import SectionErrorBoundary from "../SectionErrorBoundary.jsx"
import YdsActionSignalCenter from "../YdsActionSignalCenter.jsx"
import YdsAllocationCenter from "../YdsAllocationCenter.jsx"
import YdsCompositeHero from "../YdsCompositeHero.jsx"

/**
 * 시장분석 전용 — 패닉지수·행동·히스토리 (종목·실전매매존 제외)
 * @param {{
 *   panicData: object | null
 *   cycleMetricHistory: object[]
 * }} props
 */
export default function MarketAnalysisDeskCore({ panicData, cycleMetricHistory }) {
  const safeHistory = Array.isArray(cycleMetricHistory) ? cycleMetricHistory : []

  const cycleDataSource = useMemo(() => {
    if (panicData?.__fromHub) return "Panic Hub"
    if (panicData?.__fromHistory) return "히스토리"
    if (panicData?.__fromReport) return "리포트"
    return "수동 입력"
  }, [panicData])

  const macroRiskEnabled = isMacroRiskEnabled()
  const bondSnapshot = useMacroRiskSnapshot(macroRiskEnabled ? panicData : null)

  const aiReportStatus = useMemo(
    () => buildAiReportMarketStatus(panicData, safeHistory),
    [panicData, safeHistory],
  )

  if (!panicData && safeHistory.length === 0) {
    return null
  }

  return (
    <div className="yds-market-desk" id="market-desk" aria-label="시장 위치·행동·히스토리">
      <div className="yds-market-desk__basis">
        <CycleDataBasisBar updatedAt={panicData?.updatedAt} cycleSource={cycleDataSource} bondSource="FRED" />
        <div className="yds-market-desk__ai-status lg:hidden">
          <AiReportMarketStatusBlock status={aiReportStatus} />
        </div>
      </div>

      <div className="yds-market-desk__metrics">
        <YdsCompositeHero panicData={panicData} historyRows={safeHistory} />
        <YdsActionSignalCenter panicData={panicData} historyRows={safeHistory} />
        <YdsAllocationCenter panicData={panicData} />
        <HomeV5DeskLead panicData={panicData} historyRows={safeHistory} />
      </div>

      <SectionErrorBoundary
        label="패닉지수 히스토리"
        fallback={
          <p className="yds-market-desk__fallback">패닉지수 히스토리를 불러올 수 없습니다.</p>
        }
      >
        <PanicIndexHistorySection rows={safeHistory} />
      </SectionErrorBoundary>

      <CycleBondLiquiditySection
        panicData={panicData}
        snapshot={bondSnapshot.snapshot}
        loading={bondSnapshot.loading}
      />
    </div>
  )
}
