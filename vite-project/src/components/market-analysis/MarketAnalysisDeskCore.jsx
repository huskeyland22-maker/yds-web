import { useMemo, useEffect, useRef, useState } from "react"
import YdsPanicEvidencePanel from "./YdsPanicEvidencePanel.jsx"
import YdsTodayMarketConclusion from "./YdsTodayMarketConclusion.jsx"
import YdsMarketDeskSummary from "./YdsMarketDeskSummary.jsx"
import YdsAiMarketBriefing from "./YdsAiMarketBriefing.jsx"
import YdsMarketScoreHero from "./YdsMarketScoreHero.jsx"
import YdsMarketRecommendStrip from "./YdsMarketRecommendStrip.jsx"
import YdsMarketTop20Strip from "./YdsMarketTop20Strip.jsx"
import YdsMarketTrendSection from "./YdsMarketTrendSection.jsx"
import YdsDashboardWeekEvents from "./YdsDashboardWeekEvents.jsx"
import SectionErrorBoundary from "../SectionErrorBoundary.jsx"
import YdsDashboardLiquiditySynthesis from "./YdsDashboardLiquiditySynthesis.jsx"
import YdsDashboardLiquidityLaneDesk from "./YdsDashboardLiquidityLaneDesk.jsx"
import YdsDashboardActionGuide from "./YdsDashboardActionGuide.jsx"
import YdsDailyMarketReportPanel from "./YdsDailyMarketReportPanel.jsx"
import { isMacroRiskEnabled } from "../../macro-risk/featureFlag.js"
import { useMacroRiskSnapshot } from "../../macro-risk/useMacroRiskSnapshot.js"
import { buildMarketCycleFlowReport } from "../../content/ydsMarketCycleFlow.js"
import { fetchPanicLabBenchmarks } from "../../content/ydsEtfDailyLoader.js"
import { buildDashboardActionGuideReport } from "../../content/ydsDashboardActionGuide.js"
import { buildUnifiedWeekEventStrip } from "../../content/ydsInvestmentCalendarEngine.js"
import { buildDualLiquidityReport } from "../../market-os/liquidityDualEngine.js"
import { useYdsMarketContext } from "../../hooks/useYdsMarketContext.js"
import { logPanicIntensityAudit } from "../../utils/panicIntensityAudit.js"
import { captureTodayMarketStateHistory } from "../../content/ydsMarketStateHistory.js"
import { resolveUnifiedMarketStateLabel } from "../../content/ydsUnifiedMarketState.js"
import { getFinalScore } from "../../utils/tradingScores.js"
import { resolveMarketPositionView } from "../../content/ydsMarketPositionEngine.js"

/**
 * 시장분석 데스크 — 결론 → 추이 → 변화 → 근거 → 채권 (해석은 사이드바)
 * @param {{
 *   panicData: object | null
 *   cycleMetricHistory: object[]
 * }} props
 */
export default function MarketAnalysisDeskCore({ panicData, cycleMetricHistory }) {
  const safeHistory = Array.isArray(cycleMetricHistory) ? cycleMetricHistory : []
  const [etfPrices, setEtfPrices] = useState(
    /** @type {{ QQQ: Record<string, number>; SOXX: Record<string, number>; SPY: Record<string, number> } | null} */ (null),
  )

  useEffect(() => {
    let cancelled = false
    fetchPanicLabBenchmarks()
      .then((benchmarks) => {
        if (cancelled) return
        setEtfPrices({
          QQQ: benchmarks.QQQ ?? {},
          SOXX: benchmarks.SOX ?? {},
          SPY: benchmarks.SPY ?? {},
        })
      })
      .catch(() => {
        if (!cancelled) setEtfPrices(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const etfContext = useMemo(() => {
    if (!etfPrices) return null
    const asOfDate = safeHistory[safeHistory.length - 1]?.date ?? null
    return {
      qqqPrices: etfPrices.QQQ,
      soxxPrices: etfPrices.SOX,
      spyPrices: etfPrices.SPY,
      asOfDate,
    }
  }, [etfPrices, safeHistory])

  const cycleFlow = useMemo(
    () => buildMarketCycleFlowReport(safeHistory, undefined, etfContext),
    [safeHistory, etfContext],
  )

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
    () => buildDashboardActionGuideReport(panicData, safeHistory, dualLiquidity, cycleFlow),
    [panicData, safeHistory, dualLiquidity, cycleFlow],
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

  useEffect(() => {
    if (!panicData || !cycleFlow?.visible) return
    const date = String(safeHistory[safeHistory.length - 1]?.date ?? "").slice(0, 10)
    if (!date) return
    const positionView = resolveMarketPositionView(panicData)
    const panicScore = Math.round(getFinalScore(panicData) ?? NaN)
    captureTodayMarketStateHistory({
      date,
      unifiedLabel: resolveUnifiedMarketStateLabel(cycleFlow),
      panicScore: Number.isFinite(panicScore) ? panicScore : null,
      marketScore: positionView?.score ?? null,
      liquidityScore: dualLiquidity?.marketScore ?? null,
      cycleFlow,
    })
  }, [panicData, cycleFlow, safeHistory, dualLiquidity?.marketScore])

  if (!panicData && safeHistory.length === 0) {
    return null
  }

  return (
    <div className="yds-market-desk" id="market-desk" aria-label="YDS 시장분석">
      <div className="yds-market-desk__stream">
        <YdsTodayMarketConclusion
          panicData={panicData}
          historyRows={safeHistory}
          cycleFlow={cycleFlow}
          dualLiquidity={dualLiquidity}
          className="yds-market-desk__block yds-market-desk__slot yds-market-desk__slot--today-conclusion"
        />

        <YdsMarketDeskSummary
          panicData={panicData}
          dualLiquidity={dualLiquidity}
          cycleFlow={cycleFlow}
          className="yds-market-desk__block yds-market-desk__slot yds-market-desk__slot--desk-summary"
        />

        <YdsAiMarketBriefing
          panicData={panicData}
          cycleFlow={cycleFlow}
          dualLiquidity={dualLiquidity}
          className="yds-market-desk__block yds-market-desk__slot yds-market-desk__slot--ai-briefing"
        />

        <YdsMarketScoreHero
          className="yds-market-desk__block yds-market-desk__slot yds-market-desk__slot--score-hero"
          panicData={panicData}
          historyRows={safeHistory}
          cycleFlow={cycleFlow}
          dualLiquidity={dualLiquidity}
          etfContext={etfContext}
        />

        <YdsDailyMarketReportPanel
          panicData={panicData}
          historyRows={safeHistory}
          cycleFlow={cycleFlow}
          dualLiquidity={dualLiquidity}
          weekEvents={weekEvents}
          etfContext={etfContext}
          className="yds-market-desk__block yds-market-desk__slot yds-market-desk__slot--daily-report"
        />

        <YdsMarketTop20Strip className="yds-market-desk__slot yds-market-desk__slot--top20" />

        <YdsMarketRecommendStrip className="yds-market-desk__slot yds-market-desk__slot--recommend" />

        <YdsMarketTrendSection
          className="yds-market-desk__block yds-market-desk__slot yds-market-desk__slot--trend"
          historyRows={safeHistory}
        />

        <div className="yds-market-desk__section-stack">
          <section
            className="yds-market-desk__block yds-market-desk__slot yds-market-desk__slot--indices"
          >
            <YdsPanicEvidencePanel panicData={panicData} />
          </section>

          {macroRiskEnabled ? (
            <YdsDashboardLiquiditySynthesis
              report={dualLiquidity}
              className="yds-market-desk__slot yds-market-desk__slot--liquidity-summary"
            />
          ) : null}

          <SectionErrorBoundary label="이번주 주요 이벤트">
            <YdsDashboardWeekEvents
              report={weekEvents}
              className="yds-market-desk__slot yds-market-desk__slot--week-events"
            />
          </SectionErrorBoundary>

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
            className="yds-market-desk__slot yds-market-desk__slot--action-guide yds-market-desk__slot--desk-tail"
          />
        </div>
      </div>
    </div>
  )
}
