import { useMemo } from "react"
import { useAppDataStore } from "../store/appDataStore.js"
import { panicDataFromCycleRow } from "../utils/cycleHistoryUtils.js"
import { hasPanicMetricValues } from "../utils/resolveLatestPanicMetrics.js"
import { resolvePanicBuyDisplay } from "../content/ydsPanicBuyAsOf.js"
import MarketAnalysisDeskCore from "../components/market-analysis/MarketAnalysisDeskCore.jsx"
import YdsMarketAnalysisOpsMeta from "../components/market-analysis/YdsMarketAnalysisOpsMeta.jsx"

export default function CurrentMarketAnalysisPage() {
  const storeRows = useAppDataStore((s) => s.cycleMetricHistory)
  const historySource = useAppDataStore((s) => s.cycleHistorySource)
  const hubPanic = useAppDataStore((s) => s.hubPanicMetrics)

  const history = useMemo(() => {
    if (historySource !== "supabase-index-history" || !Array.isArray(storeRows)) return []
    return [...storeRows].sort((a, b) => String(a?.date ?? "").localeCompare(String(b?.date ?? "")))
  }, [historySource, storeRows])
  const latestCycleRow = history[history.length - 1] ?? null

  const historyPanic = useMemo(() => {
    if (!latestCycleRow) return null
    const panic = panicDataFromCycleRow(latestCycleRow)
    const rowDate = String(latestCycleRow.date ?? "").slice(0, 10)
    if (panic) {
      return {
        ...latestCycleRow,
        ...panic,
        date: /^\d{4}-\d{2}-\d{2}$/.test(rowDate) ? rowDate : latestCycleRow.date,
      }
    }
    return latestCycleRow
  }, [latestCycleRow])

  const display = useMemo(
    () =>
      resolvePanicBuyDisplay({
        historySource,
        historyPanic: historySource === "supabase-index-history" ? historyPanic : null,
        hubPanic,
      }),
    [historySource, historyPanic, hubPanic],
  )
  const panicData = display.panicData
  const chartHistory = display.source === "pro-history" ? history : []

  const hasLive = Boolean(panicData && hasPanicMetricValues(panicData))

  return (
    <div className="yds-market-analysis min-w-0 w-full">
      <header className="yds-market-analysis__header">
        <div className="yds-market-analysis__header-main">
          <h1 className="yds-market-analysis__title">공포·패닉 매수</h1>
          <p className="yds-market-analysis__subtitle">
            Panic Index · 장기 투자 참고 지표
          </p>
        </div>
        {hasLive ? <YdsMarketAnalysisOpsMeta panicData={panicData} /> : null}
      </header>

      {!hasLive ? (
        <div className="yds-market-analysis__loading" role="status" aria-live="polite">
          <span className="yds-market-analysis__loading-dot" aria-hidden />
          시장 지표를 동기화하고 있습니다. 잠시만 기다려 주세요.
        </div>
      ) : (
        <div className="yds-market-analysis__body">
          <MarketAnalysisDeskCore panicData={panicData} cycleMetricHistory={chartHistory} />
        </div>
      )}
    </div>
  )
}
