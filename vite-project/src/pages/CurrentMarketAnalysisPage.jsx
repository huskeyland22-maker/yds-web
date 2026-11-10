import { useMemo } from "react"
import { Link } from "react-router-dom"
import { useAppDataStore } from "../store/appDataStore.js"
import { usePanicStore } from "../store/panicStore.js"
import { panicDataFromCycleRow, mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import { hasPanicMetricValues } from "../utils/resolveLatestPanicMetrics.js"
import MarketAnalysisDeskCore from "../components/market-analysis/MarketAnalysisDeskCore.jsx"
import YdsMarketAnalysisOpsMeta from "../components/market-analysis/YdsMarketAnalysisOpsMeta.jsx"

/**
 * FREE users may not receive PRO-gated history series.
 * Keep score/FEAR SCALE working via latest desk/hub snapshot.
 */
function resolveLivePanicData(historyPanic, deskPanic, storePanic) {
  if (historyPanic && hasPanicMetricValues(historyPanic)) return historyPanic
  if (deskPanic && hasPanicMetricValues(deskPanic)) return deskPanic
  if (storePanic && hasPanicMetricValues(storePanic)) return storePanic
  return historyPanic ?? deskPanic ?? storePanic ?? null
}

export default function CurrentMarketAnalysisPage() {
  const storeRows = useAppDataStore((s) => s.cycleMetricHistory)
  const deskPanic = useAppDataStore((s) => s.deskResolvedPanicData)
  const hubPanic = useAppDataStore((s) => s.hubPanicMetrics)
  const storePanic = usePanicStore((s) => s.panicData)

  const history = useMemo(
    () => resolveCycleHistoryRows(mergeCycleRows(storeRows ?? [], [])),
    [storeRows],
  )
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

  const panicData = useMemo(
    () => resolveLivePanicData(historyPanic, deskPanic ?? hubPanic, storePanic),
    [historyPanic, deskPanic, hubPanic, storePanic],
  )

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
        <div className="yds-market-analysis__header-actions">
          {hasLive ? <YdsMarketAnalysisOpsMeta panicData={panicData} /> : null}
          <Link to="/ai-daily-report" className="yds-ai-cta yds-market-analysis__ai-cta">
            AI 시장 리포트
          </Link>
        </div>
      </header>

      {!hasLive ? (
        <div className="yds-market-analysis__loading" role="status" aria-live="polite">
          <span className="yds-market-analysis__loading-dot" aria-hidden />
          시장 지표를 동기화하고 있습니다. 잠시만 기다려 주세요.
        </div>
      ) : (
        <div className="yds-market-analysis__body">
          <MarketAnalysisDeskCore panicData={panicData} cycleMetricHistory={history} />
        </div>
      )}
    </div>
  )
}
