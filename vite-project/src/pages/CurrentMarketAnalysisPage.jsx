import { useMemo } from "react"
import { Link, NavLink } from "react-router-dom"
import { useAppDataStore } from "../store/appDataStore.js"
import { panicDataFromCycleRow, mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildCurrentMarketAnalysisReport,
  CURRENT_MARKET_ANALYSIS_LABEL,
} from "../trading-zone/ydsCurrentMarketAnalysis.js"
import { formatSectorRadarScore } from "../trading-zone/ydsPrecursorEnginePhase25.js"
import { formatStockRadarScore } from "../trading-zone/ydsPrecursorEnginePhase26.js"
import MarketAnalysisDashboardSummary from "../components/market-analysis/MarketAnalysisDashboardSummary.jsx"

export default function CurrentMarketAnalysisPage() {
  const storeRows = useAppDataStore((s) => s.cycleMetricHistory)
  const history = useMemo(
    () => resolveCycleHistoryRows(mergeCycleRows(storeRows ?? [], [])),
    [storeRows],
  )
  const latestCycleRow = history[history.length - 1] ?? null

  const latestSnapshot = useMemo(() => {
    if (!latestCycleRow) return null
    const panic = panicDataFromCycleRow(latestCycleRow)
    if (panic) return { ...latestCycleRow, ...panic, date: latestCycleRow.date ?? panic.updatedAt }
    return latestCycleRow
  }, [latestCycleRow])

  const report = useMemo(
    () =>
      buildCurrentMarketAnalysisReport(YDS_VALIDATION_EVENT_DATASET, {
        latestSnapshot,
        extraRows: history,
      }),
    [latestSnapshot, history],
  )

  const {
    asOf,
    hasLive,
    actionStageHero,
    actionGuide,
    portfolio,
    sectorRadar,
    stockRadar,
    entryRadar,
    marketEnvironment,
  } = report

  return (
    <div className="yds-market-analysis min-w-0 px-3 py-4 sm:px-4">
      <header className="yds-market-analysis__header">
        <div>
          <h1 className="yds-market-analysis__title">{CURRENT_MARKET_ANALYSIS_LABEL}</h1>
          <p className="yds-market-analysis__sub">
            {hasLive && asOf ? `기준 ${String(asOf).slice(0, 10)}` : "시장 데이터 동기화 중"}
          </p>
        </div>
        <nav className="yds-market-analysis__core-links" aria-label="CORE 바로가기">
          <Link to="/watchlist">Watchlist</Link>
          <Link to="/alert-center">알림</Link>
          <Link to="/ai-daily-report">AI 리포트</Link>
          <Link to="/performance-center">성과</Link>
          <Link to="/lab">Research</Link>
        </nav>
      </header>

      <nav className="yds-market-analysis__tabs" aria-label="시장분석 보기">
        <NavLink
          to="/market-analysis"
          end
          className={({ isActive }) =>
            ["yds-market-analysis__tab", isActive ? "is-active" : ""].filter(Boolean).join(" ")
          }
        >
          Hub
        </NavLink>
        <NavLink
          to="/cycle"
          className={({ isActive }) =>
            ["yds-market-analysis__tab", isActive ? "is-active" : ""].filter(Boolean).join(" ")
          }
        >
          시장 사이클
        </NavLink>
      </nav>

      <MarketAnalysisDashboardSummary
        actionStageHero={actionStageHero}
        actionGuide={actionGuide}
        marketEnvironment={marketEnvironment}
        sectorRadar={sectorRadar}
        entryRadar={entryRadar}
        portfolio={portfolio}
      />

      <section
        className={[
          "yds-market-analysis__action-hero",
          actionStageHero.id ? `yds-market-analysis__action-hero--${actionStageHero.id}` : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ "--stage-color": actionStageHero.color }}
        aria-label="현재 단계"
      >
        <h2 className="yds-market-analysis__section-title">현재 단계</h2>
        <p className="yds-market-analysis__action-hero-kicker">{actionStageHero.kicker}</p>
        <p className="yds-market-analysis__action-hero-stage">
          <span className="yds-market-analysis__action-hero-emoji" aria-hidden>
            {actionStageHero.emoji}
          </span>
          {actionStageHero.shortLabel}
        </p>
        <p className="yds-market-analysis__action-hero-desc">{actionStageHero.description}</p>
      </section>

      <section className="yds-market-analysis__block" aria-label="추천 행동">
        <h2 className="yds-market-analysis__section-title">추천 행동</h2>
        <p className="yds-market-analysis__action-oneliner">
          {actionGuide.current?.emoji} {actionGuide.oneLiner ?? "—"}
        </p>
        {actionGuide.current?.label ? (
          <p className="yds-market-analysis__section-sub">{actionGuide.current.label}</p>
        ) : null}
      </section>

      <section className="yds-market-analysis__block yds-market-analysis__sector-radar" aria-label="추천 섹터">
        <h2 className="yds-market-analysis__section-title">추천 섹터</h2>
        {sectorRadar.available ? (
          <ol className="yds-market-analysis__sector-rank">
            {sectorRadar.topSectors.slice(0, 5).map((s) => (
              <li key={s.id}>
                <span className="yds-market-analysis__sector-rank-n">{s.rank}위</span>
                <span className="yds-market-analysis__sector-rank-label">{s.label}</span>
                <span className="yds-market-analysis__sector-rank-score font-mono tabular-nums">
                  {formatSectorRadarScore(s.score)}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="yds-market-analysis__empty">섹터 추천을 산출할 수 없습니다.</p>
        )}
      </section>

      <section className="yds-market-analysis__block yds-market-analysis__stock-radar" aria-label="추천 종목">
        <h2 className="yds-market-analysis__section-title">추천 종목</h2>
        {stockRadar.available ? (
          <ol className="yds-market-analysis__stock-rank">
            {stockRadar.topBuys.slice(0, 10).map((s) => (
              <li key={s.id}>
                <span className="yds-market-analysis__stock-rank-n">{s.rank}.</span>
                <span className="yds-market-analysis__stock-rank-name">{s.name}</span>
                <span className="yds-market-analysis__stock-rank-score font-mono tabular-nums">
                  {formatStockRadarScore(s.score)}
                </span>
                <span className="yds-market-analysis__stock-rank-status">{s.status.display}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="yds-market-analysis__empty">추천 종목을 산출할 수 없습니다.</p>
        )}
        <p className="yds-market-analysis__hub-foot">
          상세 매매 계획은 <Link to="/watchlist">Watchlist</Link>, 신호는{" "}
          <Link to="/alert-center">알림</Link>에서 확인하세요.
        </p>
      </section>
    </div>
  )
}
