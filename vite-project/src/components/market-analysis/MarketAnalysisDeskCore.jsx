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
 * 시장분석 3계층 데스크
 * A 핵심 · B 중요 · C 상세(접기)
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
      {/* A — 5초 핵심: YDS · 행동 · 비중 */}
      <section className="yds-market-desk__tier yds-market-desk__tier--a" aria-labelledby="market-tier-a">
        <h2 id="market-tier-a" className="yds-market-desk__tier-label">
          핵심
        </h2>
        <div className="yds-market-desk__basis">
          <CycleDataBasisBar
            updatedAt={panicData?.updatedAt}
            cycleSource={cycleDataSource}
            bondSource="FRED"
          />
          <div className="yds-market-desk__ai-status lg:hidden">
            <AiReportMarketStatusBlock status={aiReportStatus} />
          </div>
        </div>
        <div className="yds-market-desk__core-grid">
          <YdsCompositeHero panicData={panicData} historyRows={safeHistory} />
          <div className="yds-market-desk__core-aside">
            <YdsActionSignalCenter panicData={panicData} historyRows={safeHistory} />
            <YdsAllocationCenter panicData={panicData} />
          </div>
        </div>
      </section>

      {/* B — 핵심지수 · 패닉지수 차트 */}
      <section className="yds-market-desk__tier yds-market-desk__tier--b" aria-labelledby="market-tier-b">
        <h2 id="market-tier-b" className="yds-market-desk__tier-label">
          중요
        </h2>
        <HomeV5DeskLead panicData={panicData} historyRows={safeHistory} />
        <SectionErrorBoundary
          label="패닉지수 히스토리"
          fallback={
            <p className="yds-market-desk__fallback">패닉지수 히스토리를 불러올 수 없습니다.</p>
          }
        >
          <PanicIndexHistorySection rows={safeHistory} />
        </SectionErrorBoundary>
      </section>

      {/* C — 채권·유동성 (기본 접힘) */}
      <details className="yds-market-desk__tier yds-market-desk__tier--c yds-market-desk__detail">
        <summary className="yds-market-desk__detail-summary">상세 · 채권·유동성</summary>
        <CycleBondLiquiditySection
          panicData={panicData}
          snapshot={bondSnapshot.snapshot}
          loading={bondSnapshot.loading}
        />
      </details>
    </div>
  )
}
