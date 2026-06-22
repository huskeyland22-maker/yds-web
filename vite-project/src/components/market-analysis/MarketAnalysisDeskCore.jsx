import { useMemo, useEffect, useRef } from "react"
import CycleDataBasisBar from "../cycle/CycleDataBasisBar.jsx"
import HomeV5DeskLead from "../../home-v5/HomeV5DeskLead.jsx"
import YdsMarketScoreHero from "./YdsMarketScoreHero.jsx"
import YdsMarketRecommendStrip from "./YdsMarketRecommendStrip.jsx"
import YdsMarketTrendSection from "./YdsMarketTrendSection.jsx"
import YdsMarketStateTimeline from "./YdsMarketStateTimeline.jsx"
import YdsDashboardWeekEvents from "./YdsDashboardWeekEvents.jsx"
import YdsDashboardLiquidityCard from "./YdsDashboardLiquidityCard.jsx"
import YdsDashboardActionGuide from "./YdsDashboardActionGuide.jsx"
import { isMacroRiskEnabled } from "../../macro-risk/featureFlag.js"
import { useMacroRiskSnapshot } from "../../macro-risk/useMacroRiskSnapshot.js"
import { formatCurrent } from "../../macro-risk/displayMetrics.js"
import { buildMarketCycleFlowReport } from "../../content/ydsMarketCycleFlow.js"
import { buildDashboardActionGuideReport } from "../../content/ydsDashboardActionGuide.js"
import { buildWeekEventStrip } from "../../content/ydsInvestmentCalendarEngine.js"
import { buildLiquidityEnvironmentCard } from "../../market-os/liquidityEnvironment.js"
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

  const cycleDataSource = useMemo(() => {
    if (panicData?.__fromHub) return "Panic Hub"
    if (panicData?.__fromHistory) return "히스토리"
    if (panicData?.__fromReport) return "리포트"
    return "수동 입력"
  }, [panicData])

  const macroRiskEnabled = isMacroRiskEnabled()
  const bondSnapshot = useMacroRiskSnapshot(macroRiskEnabled ? panicData : null)
  const marketContext = useYdsMarketContext()

  const weekEvents = useMemo(
    () => buildWeekEventStrip(marketContext?.ready ? marketContext : null, 5),
    [marketContext],
  )

  const liquidityCard = useMemo(() => {
    if (!macroRiskEnabled) return null
    const fmt = (key, n, fmtType = "rate") =>
      n == null || !Number.isFinite(n) ? "—" : formatCurrent(n, fmtType)
    return buildLiquidityEnvironmentCard(bondSnapshot.snapshot, panicData, fmt)
  }, [macroRiskEnabled, bondSnapshot.snapshot, panicData])

  const actionGuide = useMemo(
    () => buildDashboardActionGuideReport(panicData, safeHistory, liquidityCard),
    [panicData, safeHistory, liquidityCard],
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

        <div className="yds-market-desk__brief-stack">
          <YdsDashboardWeekEvents report={weekEvents} />
          {macroRiskEnabled ? (
            <YdsDashboardLiquidityCard card={liquidityCard} loading={bondSnapshot.loading} />
          ) : null}
          <YdsDashboardActionGuide report={actionGuide} />
        </div>
      </div>
    </div>
  )
}
