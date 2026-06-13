import { useMemo, useEffect, useRef } from "react"
import CycleBondLiquiditySection from "../cycle/CycleBondLiquiditySection.jsx"
import CycleDataBasisBar from "../cycle/CycleDataBasisBar.jsx"
import HomeV5DeskLead from "../../home-v5/HomeV5DeskLead.jsx"
import YdsMarketScoreHero from "./YdsMarketScoreHero.jsx"
import YdsMarketTrendSection from "./YdsMarketTrendSection.jsx"
import YdsMarketTimelineSection from "./YdsMarketTimelineSection.jsx"
import YdsEventScorecardSection from "./YdsEventScorecardSection.jsx"
import { useEventScorecard } from "../../hooks/useEventScorecard.js"
import { isMacroRiskEnabled } from "../../macro-risk/featureFlag.js"
import { useMacroRiskSnapshot } from "../../macro-risk/useMacroRiskSnapshot.js"
import { logPanicIntensityAudit } from "../../utils/panicIntensityAudit.js"

/**
 * 시장분석 데스크 — 결론 → 추이 → 변화 → 근거 → 이벤트 → 채권 (해석은 사이드바)
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

  const lastAuditKeyRef = useRef("")
  useEffect(() => {
    if (safeHistory.length < 1) return
    const tail = safeHistory.slice(-2)
    const key = tail.map((r) => `${r.date}:${r.vix}:${r.fearGreed}:${r.bofa}:${r.putCall}:${r.highYield}`).join("|")
    if (key === lastAuditKeyRef.current) return
    lastAuditKeyRef.current = key
    logPanicIntensityAudit(safeHistory, { days: 2 })
  }, [safeHistory])

  if (!panicData && safeHistory.length === 0) {
    return null
  }

  return (
    <div className="yds-market-desk" id="market-desk" aria-label="YDS 시장분석">
      <div className="yds-market-desk__basis">
        <CycleDataBasisBar
          updatedAt={panicData?.updatedAt}
          cycleSource={cycleDataSource}
          bondSource="FRED"
        />
      </div>

      <div className="yds-market-desk__stream">
        <YdsMarketScoreHero
          className="yds-market-desk__block yds-market-desk__slot yds-market-desk__slot--score-hero"
          panicData={panicData}
          historyRows={safeHistory}
        />

        <YdsMarketTrendSection
          className="yds-market-desk__block yds-market-desk__slot yds-market-desk__slot--trend"
          historyRows={safeHistory}
        />

        <section
          className="yds-market-desk__block yds-market-desk__slot yds-market-desk__slot--timeline"
          aria-labelledby="market-block-timeline"
        >
          <YdsMarketTimelineSection
            variant="stream"
            collapsedVisible={5}
            panicData={panicData}
            historyRows={safeHistory}
          />
        </section>

        <section
          className="yds-market-desk__block yds-market-desk__slot yds-market-desk__slot--indices"
          aria-labelledby="market-block-indices"
        >
          <h2 id="market-block-indices" className="yds-market-desk__block-label">
            핵심 지수
          </h2>
          <HomeV5DeskLead
            panicData={panicData}
            historyRows={safeHistory}
            hideSectionHeader
            metricTwoLine
          />
        </section>

        <YdsEventScorecardSection
          className="yds-market-desk__block yds-market-desk__slot yds-market-desk__slot--scorecard"
          rows={scorecardRows}
          loading={scorecardLoading}
        />

        <section
          className="yds-market-desk__block yds-market-desk__slot yds-market-desk__slot--bond"
          aria-labelledby="market-block-bond"
        >
          <h2 id="market-block-bond" className="yds-market-desk__block-label">
            유동성 환경
          </h2>
          <CycleBondLiquiditySection
            variant="desk"
            panicData={panicData}
            snapshot={bondSnapshot.snapshot}
            loading={bondSnapshot.loading}
            fetchFailed={bondSnapshot.fetchFailed}
            timedOut={bondSnapshot.timedOut}
            error={bondSnapshot.error}
          />
        </section>
      </div>
    </div>
  )
}
