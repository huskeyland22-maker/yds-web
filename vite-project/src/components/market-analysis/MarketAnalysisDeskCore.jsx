import { useMemo, useEffect, useRef } from "react"
import HomeV5DeskLead from "../../home-v5/HomeV5DeskLead.jsx"
import YdsMarketDeskSummary from "./YdsMarketDeskSummary.jsx"
import YdsMarketScoreHero from "./YdsMarketScoreHero.jsx"
import YdsMarketRecommendStrip from "./YdsMarketRecommendStrip.jsx"
import YdsMarketTrendSection from "./YdsMarketTrendSection.jsx"
import YdsMarketStateTimeline from "./YdsMarketStateTimeline.jsx"
import YdsDashboardWeekEvents from "./YdsDashboardWeekEvents.jsx"
import YdsDashboardLiquiditySynthesis from "./YdsDashboardLiquiditySynthesis.jsx"
import YdsDashboardLiquidityLaneDesk from "./YdsDashboardLiquidityLaneDesk.jsx"
import YdsDashboardActionGuide from "./YdsDashboardActionGuide.jsx"
import { isMacroRiskEnabled } from "../../macro-risk/featureFlag.js"
import { useMacroRiskSnapshot } from "../../macro-risk/useMacroRiskSnapshot.js"
import { buildMarketCycleFlowReport } from "../../content/ydsMarketCycleFlow.js"
import { buildDashboardActionGuideReport } from "../../content/ydsDashboardActionGuide.js"
import { buildUnifiedWeekEventStrip } from "../../content/ydsInvestmentCalendarEngine.js"
import { buildDualLiquidityReport } from "../../market-os/liquidityDualEngine.js"
import { useYdsMarketContext } from "../../hooks/useYdsMarketContext.js"
import { logPanicIntensityAudit } from "../../utils/panicIntensityAudit.js"

/**
 * 시장분석 데스크 — 결론 → 추이 → 변화 → 근거 → 채권 (해석은 사이드바)
 * @param {{
 *   panicData: object | null
 *   cycleMetricHistory: object[]
 * }} props
 */
export default function MarketAnalysisDeskCore({ panicData, cycleMetricHistory }) {
  const safeHistory = Array.isArray(cycleMetricHistory) ? cycleMetricHistory : []
  const cycleFlow = useMemo(() => buildMarketCycleFlowReport(safeHistory), [safeHistory])

  const macroRiskEnabled = isMacroRiskEnabled()
  const bondSnapshot = useMacroRiskSnapshot(macroRiskEnabled ? panicData : null)
  const marketContext = useYdsMarketContext()

  const weekEvents = useMemo(
    () => buildUnifiedWeekEventStrip(marketContext?.ready ? marketContext : null),
    [marketContext],
  )

  const dualLiquidity = useMemo(() => {
    if (!macroRiskEnabled) return null
    return buildDualLiquidityReport(bondSnapshot.snapshot, panicData)
  }, [macroRiskEnabled, bondSnapshot.snapshot, panicData])

  const actionGuide = useMemo(
    () => buildDashboardActionGuideReport(panicData, safeHistory, dualLiquidity),
    [panicData, safeHistory, dualLiquidity],
  )

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
      <div className="yds-market-desk__stream">
        <YdsMarketDeskSummary
          panicData={panicData}
          dualLiquidity={dualLiquidity}
          className="yds-market-desk__block yds-market-desk__slot yds-market-desk__slot--desk-summary"
        />

        <YdsMarketScoreHero
          className="yds-market-desk__block yds-market-desk__slot yds-market-desk__slot--score-hero"
          panicData={panicData}
          historyRows={safeHistory}
        />

        <section
          className="yds-market-desk__block yds-market-desk__slot yds-market-desk__slot--cycle"
          aria-labelledby="market-block-cycle"
        >
          <h2 id="market-block-cycle" className="yds-market-desk__block-label">
            시장 사이클
          </h2>
          <YdsMarketStateTimeline flow={cycleFlow} className="yds-market-desk__cycle-timeline" />
        </section>

        <YdsMarketRecommendStrip className="yds-market-desk__slot yds-market-desk__slot--recommend" />

        <YdsMarketTrendSection
          className="yds-market-desk__block yds-market-desk__slot yds-market-desk__slot--trend"
          historyRows={safeHistory}
        />

        <div className="yds-market-desk__section-stack">
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

          {macroRiskEnabled ? (
            <YdsDashboardLiquiditySynthesis
              report={dualLiquidity}
              className="yds-market-desk__slot yds-market-desk__slot--liquidity-summary"
            />
          ) : null}

          <YdsDashboardWeekEvents
            report={weekEvents}
            className="yds-market-desk__slot yds-market-desk__slot--week-events"
          />

          {macroRiskEnabled && dualLiquidity ? (
            <div className="yds-market-desk__liquidity-lanes">
              {dualLiquidity.market ? (
                <YdsDashboardLiquidityLaneDesk
                  lane={dualLiquidity.market}
                  loading={bondSnapshot.loading}
                  className="yds-market-desk__slot yds-market-desk__slot--liquidity-market"
                />
              ) : null}
              {dualLiquidity.policy ? (
                <YdsDashboardLiquidityLaneDesk
                  lane={dualLiquidity.policy}
                  loading={bondSnapshot.loading}
                  className="yds-market-desk__slot yds-market-desk__slot--liquidity-policy"
                />
              ) : null}
            </div>
          ) : null}

          <YdsDashboardActionGuide
            report={actionGuide}
            className="yds-market-desk__slot yds-market-desk__slot--action-guide"
          />
        </div>
      </div>
    </div>
  )
}
