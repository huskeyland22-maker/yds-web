import { useMemo, useEffect, useRef, useState } from "react"
import YdsPanicIndexCenter from "./YdsPanicIndexCenter.jsx"
import YdsMarketTrendSection from "./YdsMarketTrendSection.jsx"
import YdsMarketAnalysisReferenceFold from "./YdsMarketAnalysisReferenceFold.jsx"
import YdsMarketRecommendStrip from "./YdsMarketRecommendStrip.jsx"
import YdsMarketTop20Strip from "./YdsMarketTop20Strip.jsx"
import YdsDashboardWeekEvents from "./YdsDashboardWeekEvents.jsx"
import SectionErrorBoundary from "../SectionErrorBoundary.jsx"
import YdsDashboardLiquiditySynthesis from "./YdsDashboardLiquiditySynthesis.jsx"
import YdsDashboardLiquidityLaneDesk from "./YdsDashboardLiquidityLaneDesk.jsx"
import { isMacroRiskEnabled } from "../../macro-risk/featureFlag.js"
import { useMacroRiskSnapshot } from "../../macro-risk/useMacroRiskSnapshot.js"
import { buildMarketCycleFlowReport } from "../../content/ydsMarketCycleFlow.js"
import { fetchPanicLabBenchmarks } from "../../content/ydsEtfDailyLoader.js"
import { buildUnifiedWeekEventStrip } from "../../content/ydsInvestmentCalendarEngine.js"
import { buildDualLiquidityReport } from "../../market-os/liquidityDualEngine.js"
import { useYdsMarketContext } from "../../hooks/useYdsMarketContext.js"
import { logPanicIntensityAudit } from "../../utils/panicIntensityAudit.js"
import { captureTodayMarketStateHistory } from "../../content/ydsMarketStateHistory.js"
import { resolveUnifiedMarketStateLabel } from "../../content/ydsUnifiedMarketState.js"
import { getPanicScoreV2 } from "../../utils/tradingScores.js"
import { resolveMarketPositionView } from "../../content/ydsMarketPositionEngine.js"

/**
 * 시장분석 데스크 — Panic Index 중심 (장기 투자 참고)
 * 시장 상태(Market State) 사용자 UI는 노출하지 않음. 내부 히스토리 캡처·엔진은 보존.
 * @param {{
 *   panicData: object | null
 *   cycleMetricHistory: object[]
 * }} props
 */
export default function MarketAnalysisDeskCore({ panicData, cycleMetricHistory }) {
  const safeHistory = Array.isArray(cycleMetricHistory) ? cycleMetricHistory : []
  const [etfPrices, setEtfPrices] = useState(
    /** @type {{ QQQ: Record<string, number>; SOXX: Record<string, number>; SPY: Record<string, number> } | null} */ (
      null
    ),
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

  const lastAuditKeyRef = useRef("")
  useEffect(() => {
    if (safeHistory.length < 1) return
    const tail = safeHistory.slice(-2)
    const key = tail
      .map((r) => `${r.date}:${r.vix}:${r.fearGreed}:${r.bofa}:${r.putCall}:${r.highYield}`)
      .join("|")
    if (key === lastAuditKeyRef.current) return
    lastAuditKeyRef.current = key
    logPanicIntensityAudit(safeHistory, { days: 2 })
  }, [safeHistory])

  // 내부 히스토리 보존용 — 사용자 UI에는 시장 상태를 표시하지 않음
  useEffect(() => {
    if (!panicData || !cycleFlow?.visible) return
    const date = String(safeHistory[safeHistory.length - 1]?.date ?? "").slice(0, 10)
    if (!date) return
    const positionView = resolveMarketPositionView(panicData)
    const panicScore = getPanicScoreV2(panicData)
    captureTodayMarketStateHistory({
      date,
      unifiedLabel: resolveUnifiedMarketStateLabel(cycleFlow),
      panicScore: panicScore != null ? panicScore : null,
      marketScore: positionView?.score ?? null,
      liquidityScore: dualLiquidity?.marketScore ?? null,
      cycleFlow,
    })
  }, [panicData, cycleFlow, safeHistory, dualLiquidity?.marketScore])

  if (!panicData && safeHistory.length === 0) {
    return null
  }

  const hasReferenceBody =
    Boolean(macroRiskEnabled && dualLiquidity) ||
    Boolean(weekEvents) ||
    true

  return (
    <div className="yds-market-desk yds-market-desk--panic-focus" id="market-desk" aria-label="YDS 시장분석">
      <div className="yds-market-desk__stream">
        <YdsPanicIndexCenter
          panicData={panicData}
          className="yds-market-desk__block yds-market-desk__slot yds-market-desk__slot--panic-center"
        />

        <YdsMarketTrendSection
          className="yds-market-desk__block yds-market-desk__slot yds-market-desk__slot--trend"
          historyRows={safeHistory}
        />

        {hasReferenceBody ? (
          <YdsMarketAnalysisReferenceFold className="yds-market-desk__block yds-market-desk__slot yds-market-desk__slot--ref-fold">
            {macroRiskEnabled ? (
              <YdsDashboardLiquiditySynthesis
                report={dualLiquidity}
                className="yds-market-desk__slot yds-market-desk__slot--liquidity-summary"
              />
            ) : null}

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

            <SectionErrorBoundary label="이번주 주요 이벤트">
              <YdsDashboardWeekEvents
                report={weekEvents}
                className="yds-market-desk__slot yds-market-desk__slot--week-events"
              />
            </SectionErrorBoundary>

            <YdsMarketTop20Strip className="yds-market-desk__slot yds-market-desk__slot--top20" />
            <YdsMarketRecommendStrip className="yds-market-desk__slot yds-market-desk__slot--recommend" />
          </YdsMarketAnalysisReferenceFold>
        ) : null}
      </div>
    </div>
  )
}
