import { useMemo } from "react"
import { buildAiReportMarketStatus } from "../../utils/buildAiReportMarketStatus.js"
import AiReportMarketStatusBlock from "../AiReportMarketStatusBlock.jsx"
import CycleBondLiquiditySection from "../cycle/CycleBondLiquiditySection.jsx"
import CycleDataBasisBar from "../cycle/CycleDataBasisBar.jsx"
import HomeV5DeskLead from "../../home-v5/HomeV5DeskLead.jsx"
import YdsBrandHero from "./YdsBrandHero.jsx"
import YdsDualCycleHero from "./YdsDualCycleHero.jsx"
import YdsDualCycleSummaryCard from "./YdsDualCycleSummaryCard.jsx"
import { isMacroRiskEnabled } from "../../macro-risk/featureFlag.js"
import { useMacroRiskSnapshot } from "../../macro-risk/useMacroRiskSnapshot.js"
import PanicIndexHistorySection from "../PanicIndexHistorySection.jsx"
import SectionErrorBoundary from "../SectionErrorBoundary.jsx"
import YdsActionSignalCenter from "../YdsActionSignalCenter.jsx"
import YdsAllocationCenter from "../YdsAllocationCenter.jsx"
import YdsScoreBreakdownPanel from "./YdsScoreBreakdownPanel.jsx"

/**
 * 시장분석 데스크 — Dual Cycle Hero → 요약 → 핵심지수 → 히스토리 → 행동
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
    <div className="yds-market-desk" id="market-desk" aria-label="YDS Dual Cycle · 행동 · 히스토리">
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

      <YdsBrandHero />
      <YdsDualCycleHero panicData={panicData} />
      <YdsDualCycleSummaryCard panicData={panicData} />

      <section className="yds-market-desk__block" aria-labelledby="market-block-indices">
        <h2 id="market-block-indices" className="yds-market-desk__block-label">
          핵심지수
        </h2>
        <HomeV5DeskLead panicData={panicData} historyRows={safeHistory} />
      </section>

      <section className="yds-market-desk__block" aria-labelledby="market-block-history">
        <h2 id="market-block-history" className="yds-market-desk__block-label">
          YDS 총점 히스토리
        </h2>
        <SectionErrorBoundary
          label="YDS 총점 히스토리"
          fallback={
            <p className="yds-market-desk__fallback">YDS 총점 히스토리를 불러올 수 없습니다.</p>
          }
        >
          <PanicIndexHistorySection
            rows={safeHistory}
            panicData={panicData}
            inlineChart
            defaultChartOpen
          />
        </SectionErrorBoundary>
      </section>

      <section className="yds-market-desk__block" aria-labelledby="market-block-actions">
        <h2 id="market-block-actions" className="yds-market-desk__block-label">
          YDS 판단
        </h2>
        <div className="yds-market-desk__action-grid yds-market-desk__action-grid--dual">
          <div className="yds-market-desk__card-slot">
            <YdsActionSignalCenter panicData={panicData} historyRows={safeHistory} />
          </div>
          <div className="yds-market-desk__card-slot yds-market-desk__card-slot--alloc">
            <YdsAllocationCenter panicData={panicData} />
          </div>
        </div>
        <details className="yds-market-desk__score-detail">
          <summary className="yds-market-desk__score-detail-summary">YDS 총점 산출 근거</summary>
          <YdsScoreBreakdownPanel panicData={panicData} historyRows={safeHistory} />
        </details>
      </section>

      <details className="yds-market-desk__detail">
        <summary className="yds-market-desk__detail-summary">세부 분석 · 채권·유동성</summary>
        <CycleBondLiquiditySection
          panicData={panicData}
          snapshot={bondSnapshot.snapshot}
          loading={bondSnapshot.loading}
        />
      </details>
    </div>
  )
}
