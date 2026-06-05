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
 * 시장분석 데스크 — 핵심지수 → 패닉 히스토리 → YDS 카드 그리드
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
        <CycleDataBasisBar
          updatedAt={panicData?.updatedAt}
          cycleSource={cycleDataSource}
          bondSource="FRED"
        />
        <div className="yds-market-desk__ai-status lg:hidden">
          <AiReportMarketStatusBlock status={aiReportStatus} />
        </div>
      </div>

      {/* 1. 핵심지수 */}
      <section className="yds-market-desk__block" aria-labelledby="market-block-indices">
        <h2 id="market-block-indices" className="yds-market-desk__block-label">
          핵심지수
        </h2>
        <HomeV5DeskLead panicData={panicData} historyRows={safeHistory} />
      </section>

      {/* 2. 패닉지수 히스토리 (요약 + 차트) */}
      <section className="yds-market-desk__block" aria-labelledby="market-block-history">
        <h2 id="market-block-history" className="yds-market-desk__block-label">
          패닉지수 흐름
        </h2>
        <SectionErrorBoundary
          label="패닉지수 히스토리"
          fallback={
            <p className="yds-market-desk__fallback">패닉지수 히스토리를 불러올 수 없습니다.</p>
          }
        >
          <PanicIndexHistorySection rows={safeHistory} inlineChart defaultChartOpen />
        </SectionErrorBoundary>
      </section>

      {/* 3. 시장위치 · 행동 · 자산배분 */}
      <section className="yds-market-desk__block" aria-labelledby="market-block-actions">
        <h2 id="market-block-actions" className="yds-market-desk__block-label">
          YDS 판단
        </h2>
        <div className="yds-market-desk__action-grid">
          <div className="yds-market-desk__card-slot">
            <YdsCompositeHero panicData={panicData} historyRows={safeHistory} />
          </div>
          <div className="yds-market-desk__card-slot">
            <YdsActionSignalCenter panicData={panicData} historyRows={safeHistory} />
          </div>
          <div className="yds-market-desk__card-slot yds-market-desk__card-slot--alloc">
            <YdsAllocationCenter panicData={panicData} />
          </div>
        </div>
      </section>

      {/* 4. 세부 — 채권·유동성 (접기) */}
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
