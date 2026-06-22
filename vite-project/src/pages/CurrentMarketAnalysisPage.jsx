import { useMemo, useState } from "react"
import { useAppDataStore } from "../store/appDataStore.js"
import { panicDataFromCycleRow, mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import MarketAnalysisDeskCore from "../components/market-analysis/MarketAnalysisDeskCore.jsx"
import YdsMarketAnalysisOpsMeta from "../components/market-analysis/YdsMarketAnalysisOpsMeta.jsx"
import LaunchFirstVisitPanel from "../components/launch/LaunchFirstVisitPanel.jsx"
import LaunchFooterNav from "../components/launch/LaunchFooterNav.jsx"
import YdsV1ReleaseBadge from "../components/trust/YdsV1ReleaseBadge.jsx"
import {
  completeLaunchOnboarding,
  isLaunchOnboardingComplete,
} from "../utils/ydsLaunchOnboardingStorage.js"

export default function CurrentMarketAnalysisPage() {
  const [showFull, setShowFull] = useState(() => isLaunchOnboardingComplete())
  const simplified = !showFull

  const storeRows = useAppDataStore((s) => s.cycleMetricHistory)
  const history = useMemo(
    () => resolveCycleHistoryRows(mergeCycleRows(storeRows ?? [], [])),
    [storeRows],
  )
  const latestCycleRow = history[history.length - 1] ?? null

  const panicData = useMemo(() => {
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

  const hasLive = Boolean(panicData)

  return (
    <div className="yds-market-analysis min-w-0 w-full">
      <header className="yds-market-analysis__header">
        <div className="yds-market-analysis__header-main">
          {!simplified ? <YdsV1ReleaseBadge compact /> : null}
          <h1 className="yds-market-analysis__title">시장분석</h1>
        </div>
        {hasLive ? <YdsMarketAnalysisOpsMeta panicData={panicData} /> : null}
      </header>

      {simplified ? (
        <LaunchFirstVisitPanel
          onShowFull={() => {
            completeLaunchOnboarding()
            setShowFull(true)
          }}
        />
      ) : !hasLive ? (
        <div className="yds-market-analysis__loading" role="status" aria-live="polite">
          <span className="yds-market-analysis__loading-dot" aria-hidden />
          시장 지표를 동기화하고 있습니다. 잠시만 기다려 주세요.
        </div>
      ) : (
        <div className="yds-market-analysis__body">
          <MarketAnalysisDeskCore panicData={panicData} cycleMetricHistory={history} />
        </div>
      )}

      {simplified ? <LaunchFooterNav /> : null}
    </div>
  )
}
