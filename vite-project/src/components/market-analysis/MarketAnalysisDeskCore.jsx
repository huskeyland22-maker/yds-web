import { useMemo, useEffect, useRef, useState } from "react"
import YdsPanicEvidencePanel from "./YdsPanicEvidencePanel.jsx"
import YdsMarketDeskSummary from "./YdsMarketDeskSummary.jsx"
import YdsMarketScoreHero from "./YdsMarketScoreHero.jsx"
import YdsMarketRecommendStrip from "./YdsMarketRecommendStrip.jsx"
import YdsMarketTrendSection from "./YdsMarketTrendSection.jsx"
import YdsDashboardWeekEvents from "./YdsDashboardWeekEvents.jsx"
import YdsDashboardLiquiditySynthesis from "./YdsDashboardLiquiditySynthesis.jsx"
import YdsDashboardLiquidityLaneDesk from "./YdsDashboardLiquidityLaneDesk.jsx"
import YdsDashboardActionGuide from "./YdsDashboardActionGuide.jsx"
import { isMacroRiskEnabled } from "../../macro-risk/featureFlag.js"
import { useMacroRiskSnapshot } from "../../macro-risk/useMacroRiskSnapshot.js"
import { buildMarketCycleFlowReport } from "../../content/ydsMarketCycleFlow.js"
import { fetchPanicLabBenchmarks } from "../../content/ydsEtfDailyLoader.js"
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
  const [etfPrices, setEtfPrices] = useState(
    /** @type {{ QQQ: Record<string, number>; SOXX: Record<string, number> } | null} */ (null),
  )

  useEffect(() => {
    let cancelled = false
    fetchPanicLabBenchmarks()
      .then((benchmarks) => {
        if (cancelled) return
        setEtfPrices({
          QQQ: benchmarks.QQQ ?? {},
          SOXX: benchmarks.SOX ?? {},
        })
      })
      .catch(() => {
        if (!cancelled) setEtfPrices(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const cycleFlow = useMemo(() => {
    const asOfDate = safeHistory[safeHistory.length - 1]?.date ?? null
    const etfContext = etfPrices
      ? {
          qqqPrices: etfPrices.QQQ,
          soxxPrices: etfPrices.SOX,
          asOfDate,
        }
      : null
    return buildMarketCycleFlowReport(safeHistory, undefined, etfContext)
  }, [safeHistory, etfPrices])

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
          cycleFlow={cycleFlow}
          className="yds-market-desk__block yds-market-desk__slot yds-market-desk__slot--desk-summary"
        />

        <YdsMarketScoreHero
          className="yds-market-desk__block yds-market-desk__slot yds-market-desk__slot--score-hero"
          panicData={panicData}
          historyRows={safeHistory}
          cycleFlow={cycleFlow}
        />

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
