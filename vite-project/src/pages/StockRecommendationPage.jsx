import { useMemo } from "react"
import { Link } from "react-router-dom"
import { useAppDataStore } from "../store/appDataStore.js"
import { panicDataFromCycleRow, mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import { getFinalScore } from "../utils/tradingScores.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../trading-zone/ydsHistoricalValidationEvents.js"
import { buildCurrentMarketAnalysisReport } from "../trading-zone/ydsCurrentMarketAnalysis.js"
import { isMacroRiskEnabled } from "../macro-risk/featureFlag.js"
import { useMacroRiskSnapshot } from "../macro-risk/useMacroRiskSnapshot.js"
import StockRecommendationRadarPanels from "../components/stock-picks/StockRecommendationRadarPanels.jsx"
import WatchlistCenterPage from "./WatchlistCenterPage.jsx"
import TacticalTradingZoneSection from "../components/trading-zone/TacticalTradingZoneSection.jsx"
import RecommendationJourneyStrip from "../components/journey/RecommendationJourneyStrip.jsx"
import SectionErrorBoundary from "../components/SectionErrorBoundary.jsx"
import { UI_PAGE } from "../utils/ydsUiLabels.js"

export default function StockRecommendationPage() {
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

  const latestSnapshot = panicData

  const report = useMemo(
    () =>
      buildCurrentMarketAnalysisReport(YDS_VALIDATION_EVENT_DATASET, {
        latestSnapshot,
        extraRows: history,
      }),
    [latestSnapshot, history],
  )

  const finalScore = useMemo(() => (panicData ? getFinalScore(panicData) : null), [panicData])
  const macroRiskEnabled = isMacroRiskEnabled()
  const bondSnapshot = useMacroRiskSnapshot(macroRiskEnabled ? panicData : null)

  return (
    <div className="yds-stock-reco min-w-0 px-3 py-4 sm:px-4">
      <header className="yds-stock-reco__header">
        <div>
          <p className="yds-stock-reco__kicker">{UI_PAGE.stockPicks.kicker}</p>
          <h1 className="yds-stock-reco__title">{UI_PAGE.stockPicks.title}</h1>
          <p className="yds-stock-reco__sub">
            섹터 → 종목 → 관심종목 → 실전매매 · 시장 판단은{" "}
            <Link to="/market-analysis">시장분석</Link>
          </p>
        </div>
        <Link to="/market-analysis" className="yds-stock-reco__link">
          시장분석
        </Link>
      </header>

      <RecommendationJourneyStrip step="watchlist" />

      <StockRecommendationRadarPanels report={report} />

      <section className="yds-stock-reco__section" aria-labelledby="stock-reco-watchlist">
        <h2 id="stock-reco-watchlist" className="yds-stock-reco__h2">
          관심종목
        </h2>
        <WatchlistCenterPage embedded />
      </section>

      <section className="yds-stock-reco__section" aria-labelledby="stock-reco-trading">
        <h2 id="stock-reco-trading" className="yds-stock-reco__h2">
          실전매매존
        </h2>
        <SectionErrorBoundary label="실전매매존">
          <TacticalTradingZoneSection
            panicData={panicData}
            cycleScore={finalScore}
            snapshot={bondSnapshot.snapshot}
            historyRows={history}
          />
        </SectionErrorBoundary>
      </section>
    </div>
  )
}
