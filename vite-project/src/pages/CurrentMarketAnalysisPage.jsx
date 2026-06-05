import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useAppDataStore } from "../store/appDataStore.js"
import { panicDataFromCycleRow, mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../trading-zone/ydsHistoricalValidationEvents.js"
import { buildCurrentMarketAnalysisReport } from "../trading-zone/ydsCurrentMarketAnalysis.js"
import MarketAnalysisHubTop from "../components/market-analysis/MarketAnalysisHubTop.jsx"
import MarketAnalysisDeskCore from "../components/market-analysis/MarketAnalysisDeskCore.jsx"
import LaunchFirstVisitPanel from "../components/launch/LaunchFirstVisitPanel.jsx"
import { UI_PAGE } from "../utils/ydsUiLabels.js"
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
    if (panic) return { ...latestCycleRow, ...panic, date: latestCycleRow.date ?? panic.updatedAt }
    return latestCycleRow
  }, [latestCycleRow])

  const report = useMemo(
    () =>
      buildCurrentMarketAnalysisReport(YDS_VALIDATION_EVENT_DATASET, {
        latestSnapshot: panicData,
        extraRows: history,
      }),
    [panicData, history],
  )

  const { asOf, hasLive } = report

  return (
    <div className="yds-market-analysis min-w-0 px-3 py-4 sm:px-4">
      <header className="yds-market-analysis__header">
        <div>
          {!simplified ? <YdsV1ReleaseBadge compact /> : null}
          <h1 className="yds-market-analysis__title">시장분석</h1>
          <p className="yds-market-analysis__sub">
            {hasLive && asOf
              ? `기준 ${String(asOf).slice(0, 10)}`
              : "시장 데이터를 불러오는 중…"}
          </p>
        </div>
        {!simplified ? (
          <nav className="yds-market-analysis__core-links" aria-label="CORE 바로가기">
            <Link to="/stock-picks">{UI_PAGE.stockPicks.title}</Link>
            <Link to="/alert-center">{UI_PAGE.alert.title}</Link>
            <Link to="/ai-daily-report">AI 리포트</Link>
            <Link to="/performance-center">{UI_PAGE.performance.title}</Link>
            <Link to="/lab">{UI_PAGE.research.title}</Link>
            <Link to="/glossary">용어</Link>
          </nav>
        ) : null}
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
        <>
          <MarketAnalysisDeskCore panicData={panicData} cycleMetricHistory={history} />
          <MarketAnalysisHubTop report={report} marketOnly />
        </>
      )}

      {simplified ? <LaunchFooterNav /> : null}
    </div>
  )
}
