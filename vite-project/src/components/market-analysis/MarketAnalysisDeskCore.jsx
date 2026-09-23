import { useMemo, useEffect, useRef, useState } from "react"
import YdsPanicIndexCenter from "./YdsPanicIndexCenter.jsx"
import YdsMarketTrendSection from "./YdsMarketTrendSection.jsx"
import { isMacroRiskEnabled } from "../../macro-risk/featureFlag.js"
import { useMacroRiskSnapshot } from "../../macro-risk/useMacroRiskSnapshot.js"
import { buildMarketCycleFlowReport } from "../../content/ydsMarketCycleFlow.js"
import { fetchPanicLabBenchmarks } from "../../content/ydsEtfDailyLoader.js"
import { buildDualLiquidityReport } from "../../market-os/liquidityDualEngine.js"
import { logPanicIntensityAudit } from "../../utils/panicIntensityAudit.js"
import { captureTodayMarketStateHistory } from "../../content/ydsMarketStateHistory.js"
import { resolveUnifiedMarketStateLabel } from "../../content/ydsUnifiedMarketState.js"
import { getPanicScoreV2 } from "../../utils/tradingScores.js"
import { resolveMarketPositionView } from "../../content/ydsMarketPositionEngine.js"
import YdsPanicTradeRecordPanel from "./YdsPanicTradeRecordPanel.jsx"

/**
 * 시장분석 데스크 — Panic Index 중심 (장기 투자 참고)
 * 노출: Panic Index · FEAR SCALE · HISTORY · DRIVERS
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
      soxxPrices: etfPrices.SOXX,
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

  const spyPrices = etfPrices?.SPY ?? null
  const spyDates = spyPrices ? Object.keys(spyPrices).sort() : []
  const spyLastDate = spyDates.length ? spyDates[spyDates.length - 1] : null
  const spyLastPrice =
    spyLastDate != null && Number.isFinite(Number(spyPrices[spyLastDate]))
      ? Number(spyPrices[spyLastDate])
      : null
  const panicAsOf =
    panicData?.date ??
    panicData?.asOfDate ??
    safeHistory[safeHistory.length - 1]?.date ??
    spyLastDate ??
    null

  return (
    <div className="yds-market-desk yds-market-desk--panic-focus" id="market-desk" aria-label="YDS 시장분석">
      <div className="yds-market-desk__stream">
        <YdsPanicIndexCenter
          panicData={panicData}
          className="yds-market-desk__block yds-market-desk__slot yds-market-desk__slot--panic-center"
          historySlot={
            <YdsMarketTrendSection
              className="yds-market-desk__slot yds-market-desk__slot--trend"
              historyRows={safeHistory}
            />
          }
        />
        <YdsPanicTradeRecordPanel
          panicData={panicData}
          currentPrice={spyLastPrice}
          asOfDate={typeof panicAsOf === "string" ? String(panicAsOf).slice(0, 10) : null}
          className="yds-market-desk__block yds-market-desk__slot yds-market-desk__slot--trade-rec"
        />
      </div>
    </div>
  )
}
