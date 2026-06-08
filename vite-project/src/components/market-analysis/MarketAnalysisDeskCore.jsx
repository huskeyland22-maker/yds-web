import { useMemo } from "react"
import CycleBondLiquiditySection from "../cycle/CycleBondLiquiditySection.jsx"
import CycleDataBasisBar from "../cycle/CycleDataBasisBar.jsx"
import HomeV5DeskLead from "../../home-v5/HomeV5DeskLead.jsx"
import YdsMarketHeroStack from "./YdsMarketHeroStack.jsx"
import YdsMarketTimelineSection from "./YdsMarketTimelineSection.jsx"
import YdsEventScorecardSection from "./YdsEventScorecardSection.jsx"
import YdsDualCycleHero from "./YdsDualCycleHero.jsx"
import { useEventScorecard } from "../../hooks/useEventScorecard.js"
import { isMacroRiskEnabled } from "../../macro-risk/featureFlag.js"
import { useMacroRiskSnapshot } from "../../macro-risk/useMacroRiskSnapshot.js"
import PanicIndexHistorySection from "../PanicIndexHistorySection.jsx"
import SectionErrorBoundary from "../SectionErrorBoundary.jsx"
import YdsActionSignalCenter from "../YdsActionSignalCenter.jsx"
import YdsScoreBreakdownPanel from "./YdsScoreBreakdownPanel.jsx"
import {
  YDS_LABEL_PANIC_BREAKDOWN,
  YDS_LABEL_PANIC_HISTORY,
} from "../../content/ydsLanguage.js"

/**
 * 시장분석 데스크 — 전환점 → Hero → 핵심지수 → 히스토리 → 행동
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

  const { rows: scorecardRows, loading: scorecardLoading } = useEventScorecard(safeHistory, panicData)

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
      </div>

      <div className="yds-market-desk__stream">
        <YdsMarketHeroStack panicData={panicData} historyRows={safeHistory} />

        <section
          className="yds-market-desk__block yds-market-desk__slot yds-market-desk__slot--actions"
          aria-labelledby="market-block-actions"
        >
          <h2 id="market-block-actions" className="yds-market-desk__block-label">
            오늘의 행동
          </h2>
          <YdsActionSignalCenter panicData={panicData} historyRows={safeHistory} />
        </section>

        <section
          className="yds-market-desk__block yds-market-desk__slot yds-market-desk__slot--indices"
          aria-labelledby="market-block-indices"
        >
          <h2 id="market-block-indices" className="yds-market-desk__block-label">
            핵심지수
          </h2>
          <HomeV5DeskLead panicData={panicData} historyRows={safeHistory} />
        </section>
      </div>

      <details className="yds-market-desk__detail yds-market-desk__detail--stream">
        <summary className="yds-market-desk__detail-summary">근거 · 히스토리 · 세부 분석</summary>
        <div className="yds-market-desk__detail-body">
          <YdsMarketTimelineSection
            className="yds-market-desk__slot yds-market-desk__slot--timeline"
            panicData={panicData}
            historyRows={safeHistory}
          />
          <SectionErrorBoundary
            label={YDS_LABEL_PANIC_HISTORY}
            fallback={
              <p className="yds-market-desk__fallback">{YDS_LABEL_PANIC_HISTORY}를 불러올 수 없습니다.</p>
            }
          >
            <PanicIndexHistorySection
              rows={safeHistory}
              panicData={panicData}
              inlineChart
              defaultChartOpen={false}
            />
          </SectionErrorBoundary>
          <details className="yds-market-desk__score-detail">
            <summary className="yds-market-desk__score-detail-summary">{YDS_LABEL_PANIC_BREAKDOWN}</summary>
            <YdsScoreBreakdownPanel panicData={panicData} historyRows={safeHistory} />
          </details>
          <YdsEventScorecardSection rows={scorecardRows} loading={scorecardLoading} />
          <YdsDualCycleHero panicData={panicData} historyRows={safeHistory} />
        </div>
      </details>

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
