import { useEffect, useMemo, useState } from "react"
import { useAppDataStore } from "../store/appDataStore.js"
import { panicDataFromCycleRow } from "../utils/cycleHistoryUtils.js"
import { hasPanicMetricValues } from "../utils/resolveLatestPanicMetrics.js"
import {
  resolvePanicBuyDisplay,
  resolvePanicBuyLoadingState,
} from "../content/ydsPanicBuyAsOf.js"
import MarketAnalysisDeskCore from "../components/market-analysis/MarketAnalysisDeskCore.jsx"
import YdsMarketAnalysisOpsMeta from "../components/market-analysis/YdsMarketAnalysisOpsMeta.jsx"

const BOOT_FORCE_MS = 10_000

export default function CurrentMarketAnalysisPage() {
  const storeRows = useAppDataStore((s) => s.cycleMetricHistory)
  const historySource = useAppDataStore((s) => s.cycleHistorySource)
  const hubPanic = useAppDataStore((s) => s.hubPanicMetrics)
  const latestHistoryRow = useAppDataStore((s) => s.latestHistoryRow)
  const panicIndexFetchedAt = useAppDataStore((s) => s.panicIndexFetchedAt)
  const panicDeskSourcesFetchedAt = useAppDataStore((s) => s.panicDeskSourcesFetchedAt)
  const lastCycleBundleError = useAppDataStore((s) => s.lastCycleBundleError)
  const loadDeskMetricSources = useAppDataStore((s) => s.loadDeskMetricSources)
  const [forceSettled, setForceSettled] = useState(false)

  useEffect(() => {
    void loadDeskMetricSources()
    const timer = window.setTimeout(() => setForceSettled(true), BOOT_FORCE_MS)
    return () => window.clearTimeout(timer)
  }, [loadDeskMetricSources])

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
        latestHistoryRow,
      }),
    [historySource, historyPanic, hubPanic, latestHistoryRow],
  )
  const panicData = display.panicData
  const chartHistory = display.source === "pro-history" ? history : []

  const hasLive = Boolean(panicData && hasPanicMetricValues(panicData))
  const bootSettled =
    forceSettled ||
    panicDeskSourcesFetchedAt != null ||
    panicIndexFetchedAt != null ||
    lastCycleBundleError != null
  const loadingState = resolvePanicBuyLoadingState({ bootSettled, hasLive })
  const emptyMessage = lastCycleBundleError
    ? "시장 지표를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
    : hubPanic?.__emergency === true
      ? "시장 지표 저장소에 데이터가 없습니다. Preview Staging 스키마 또는 미러 설정을 확인해 주세요."
      : "표시할 시장 지표가 없습니다. 잠시 후 다시 확인해 주세요."

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

      {loadingState.showSyncing ? (
        <div className="yds-market-analysis__loading" role="status" aria-live="polite">
          <span className="yds-market-analysis__loading-dot" aria-hidden />
          시장 지표를 동기화하고 있습니다. 잠시만 기다려 주세요.
        </div>
      ) : loadingState.showEmpty ? (
        <div className="yds-market-analysis__loading" role="status" aria-live="polite">
          {emptyMessage}
        </div>
      ) : (
        <div className="yds-market-analysis__body">
          <MarketAnalysisDeskCore panicData={panicData} cycleMetricHistory={chartHistory} />
        </div>
      )}
    </div>
  )
}
