import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { traceStockPickMount } from "../../content/ydsStockPickMountTrace.js"
import { captureTodayPickSnapshots, refreshValidationPicks } from "../../content/ydsValidationEngine.js"
import { buildValidationPriceMap } from "../../content/ydsValidationPriceResolver.js"
import { loadValidationPicks } from "../../content/ydsValidationStorage.js"
import {
  assignRanks,
  filterByCountry,
  STOCK_PICK_COUNTRIES,
} from "../../content/ydsStockPickModel.js"
import { markFirstRender, recordSearchFilterMs } from "../../content/ydsStockPickPerf.js"
import { recordRenderPhase } from "../../content/ydsStockPickRenderPerf.js"
import {
  getRegimeDisplayLimit,
  getRegimeTopStocks,
} from "../../content/ydsStockPickMarketRegime.js"
import { filterStockPicksByQuery } from "../../content/ydsStockPickSearch.js"
import { useStockPickFavoriteAlerts } from "../../hooks/useStockPickFavoriteAlerts.js"
import { useStockPickAlerts } from "../../hooks/useStockPickAlerts.js"
import { useStockPickFavorites } from "../../hooks/useStockPickFavorites.js"
import { useStockPickDualColumnAlign } from "../../hooks/useStockPickDualColumnAlign.js"
import { useStockPickLiveData } from "../../hooks/useStockPickLiveData.js"
import { useYdsMarketContext } from "../../hooks/useYdsMarketContext.js"
import { useStockPickHeldTickers } from "../../hooks/useStockPickHeldTickers.js"
import YdsStockPickScoreDebugPanel from "./YdsStockPickScoreDebugPanel.jsx"
import YdsStockPickFavoriteAlerts from "./YdsStockPickFavoriteAlerts.jsx"
import YdsStockPickMarketRegimeBanner from "./YdsStockPickMarketRegimeBanner.jsx"
import YdsStockPickDebugBox from "./YdsStockPickDebugBox.jsx"
import YdsStockPickLoadBanner from "./YdsStockPickLoadBanner.jsx"
import YdsStockPickSearchBar from "./YdsStockPickSearchBar.jsx"
import YdsStockPickCountryTabs from "./YdsStockPickCountryTabs.jsx"
import YdsStockPickCountryPanel from "./YdsStockPickCountryPanel.jsx"
import YdsStockPickTodaySignal from "./YdsStockPickTodaySignal.jsx"
import YdsRecommendPerformanceReport from "./YdsRecommendPerformanceReport.jsx"
import YdsStockPickHubExtras from "./YdsStockPickHubExtras.jsx"
import {
  buildTodayRecommendBriefing,
  buildStockPickHubHistoryReport,
} from "../../content/ydsStockPickTrustEngine.js"
import { buildStockPickInvestDashboard } from "../../content/ydsStockPickDashboardEngine.js"
import {
  DEFAULT_STOCK_PICK_FILTERS,
  applyStockPickFilters,
} from "../../content/ydsStockPickFilterEngine.js"
import YdsStockPickTodayBriefing from "./YdsStockPickTodayBriefing.jsx"
import YdsStockPickHubHistory from "./YdsStockPickHubHistory.jsx"
import YdsStockPickInvestDashboard from "./YdsStockPickInvestDashboard.jsx"
import YdsStockPickFilterBar from "./YdsStockPickFilterBar.jsx"
import { useStockPickHubScrollRestore } from "../../hooks/useStockPickHubScrollRestore.js"
import YdsStockPickHubSkeleton from "./YdsStockPickHubSkeleton.jsx"
import { isDevMode } from "../../utils/devMode.js"

const INITIAL_SECTOR = { US: "all", KR: "all" }
const DUAL_LAYOUT_MQ = "(min-width: 1024px)"

function useDualCountryLayout() {
  const [dualLayout, setDualLayout] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(DUAL_LAYOUT_MQ).matches,
  )

  useEffect(() => {
    const mq = window.matchMedia(DUAL_LAYOUT_MQ)
    const onChange = () => setDualLayout(mq.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  return dualLayout
}

export default function YdsStockPickV1Hub() {
  const showDebug = isDevMode()
  useStockPickHubScrollRestore()
  useEffect(() => {
    traceStockPickMount("YdsStockPickV1Hub", "mount")
    return () => traceStockPickMount("YdsStockPickV1Hub", "unmount")
  }, [])

  const dualLayout = useDualCountryLayout()
  const dualRef = useStockPickDualColumnAlign(dualLayout)
  const marketContext = useYdsMarketContext()
  const {
    stocks: liveStocks,
    allStocks,
    loadStats,
    pipelineDebug,
    loading,
    refreshing,
    fromCache,
    lastSyncAt,
  } = useStockPickLiveData(marketContext)
  const heldTickers = useStockPickHeldTickers()

  const [validationRevision, setValidationRevision] = useState(0)

  useEffect(() => {
    if (loading || !liveStocks.length) return
    const run = () => {
      captureTodayPickSnapshots(marketContext, 10, liveStocks)
      refreshValidationPicks(loadValidationPicks(), buildValidationPriceMap(liveStocks), {
        liveStocks,
        marketContext,
      })
      setValidationRevision((v) => v + 1)
    }
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(run, { timeout: 3000 })
      return () => cancelIdleCallback(id)
    }
    const id = setTimeout(run, 0)
    return () => clearTimeout(id)
  }, [marketContext, loading, liveStocks])

  const {
    favorites,
    isFavorite,
    toggleFavorite,
  } = useStockPickFavorites()

  const favoriteAlerts = useStockPickFavoriteAlerts(liveStocks, favorites)
  const pickAlerts = useStockPickAlerts(liveStocks)

  const regimeLimit = useMemo(
    () => marketContext.pickDisplayLimit ?? getRegimeDisplayLimit(marketContext.marketPositionId),
    [marketContext.pickDisplayLimit, marketContext.marketPositionId],
  )

  const usPortfolioStocks = useMemo(() => {
    const us = assignRanks(filterByCountry(liveStocks, "US"))
    return getRegimeTopStocks(us, regimeLimit)
  }, [liveStocks, regimeLimit])

  const [countryId, setCountryId] = useState("US")
  const [sectorByCountry, setSectorByCountry] = useState(INITIAL_SECTOR)
  const [searchQuery, setSearchQuery] = useState("")
  const [listFilters, setListFilters] = useState(() => ({ ...DEFAULT_STOCK_PICK_FILTERS }))

  const searchedStocks = useMemo(() => {
    const t0 = typeof performance !== "undefined" ? performance.now() : 0
    const result = filterStockPicksByQuery(liveStocks, searchQuery)
    if (typeof performance !== "undefined" && searchQuery.trim()) {
      recordSearchFilterMs(performance.now() - t0)
    }
    return result
  }, [liveStocks, searchQuery])

  const stocksByCountry = useMemo(() => {
    const canPerf = typeof performance !== "undefined"
    const t0 = canPerf ? performance.now() : 0
    const ranked = {
      US: assignRanks(filterByCountry(searchedStocks, "US")),
      KR: assignRanks(filterByCountry(searchedStocks, "KR")),
    }
    if (canPerf) {
      recordRenderPhase("country split+sort", performance.now() - t0)
    }
    return {
      US: ranked.US,
      KR: ranked.KR,
    }
  }, [searchedStocks])

  const universeByCountry = useMemo(
    () => ({
      US: filterByCountry(allStocks, "US"),
      KR: filterByCountry(allStocks, "KR"),
    }),
    [allStocks],
  )

  useEffect(() => {
    if (stocksByCountry.US.length || stocksByCountry.KR.length) {
      markFirstRender()
    }
  }, [stocksByCountry.US.length, stocksByCountry.KR.length])

  const setSectorForCountry = (country, sectorId) => {
    setSectorByCountry((prev) => ({ ...prev, [country]: sectorId }))
    setListFilters((prev) => ({ ...prev, sector: sectorId }))
  }

  const handleListFiltersChange = (next) => {
    setListFilters(next)
    if (next.country && next.country !== "all") {
      setCountryId(next.country)
    }
    if (next.sector) {
      setSectorByCountry((prev) => ({
        ...prev,
        [countryId]: next.sector,
      }))
    }
  }

  const debugView = useMemo(
    () => ({
      ...pipelineDebug,
      displayUs: stocksByCountry.US.length,
      displayKr: stocksByCountry.KR.length,
      fromCache,
      refreshing,
    }),
    [
      pipelineDebug,
      stocksByCountry.US.length,
      stocksByCountry.KR.length,
      fromCache,
      refreshing,
    ],
  )

  const searchResultCount = searchedStocks.length
  const scoreDebugSample = stocksByCountry.US[0] ?? stocksByCountry.KR[0] ?? null

  const todayBriefing = useMemo(
    () =>
      buildTodayRecommendBriefing(
        liveStocks,
        marketContext?.ready ? marketContext : null,
        regimeLimit,
      ),
    [liveStocks, marketContext, regimeLimit],
  )

  const hubHistory = useMemo(
    () => buildStockPickHubHistoryReport(liveStocks),
    [liveStocks, validationRevision],
  )

  const activeStocks = stocksByCountry[countryId]
  const activeRegimeStocks = useMemo(
    () => getRegimeTopStocks(activeStocks, regimeLimit),
    [activeStocks, regimeLimit],
  )

  const investDashboard = useMemo(
    () => buildStockPickInvestDashboard(liveStocks, regimeLimit),
    [liveStocks, regimeLimit],
  )

  const filteredActiveCount = useMemo(
    () => applyStockPickFilters(activeStocks, listFilters, { isFavorite }).length,
    [activeStocks, listFilters, isFavorite],
  )

  const initialLoading = loading && !liveStocks.length

  return (
    <div className="yds-spick-platform yds-spick-platform--report">
      {showDebug ? <YdsStockPickDebugBox debug={debugView} loading={initialLoading} /> : null}
      {showDebug ? <YdsStockPickScoreDebugPanel sample={scoreDebugSample} /> : null}
      <YdsStockPickLoadBanner
        stats={loadStats}
        lastSyncAt={lastSyncAt}
        fromCache={fromCache}
        loading={initialLoading}
      />
      {refreshing ? (
        <p className="yds-spick-sync-note yds-spick-sync-note--refresh" role="status">
          백그라운드 갱신 중…
        </p>
      ) : null}
      {lastSyncAt ? (
        <p className="yds-spick-sync-note" role="status">
          {fromCache ? "캐시 표시 · " : ""}
          마지막 동기화{" "}
          {new Date(lastSyncAt).toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })}
        </p>
      ) : null}

      <div className="yds-spick-hub-sticky">
        <YdsStockPickInvestDashboard
          report={investDashboard}
          className="yds-spick-invest-dash--sticky"
        />

        <YdsStockPickFilterBar
          filters={listFilters}
          onChange={handleListFiltersChange}
          resultCount={filteredActiveCount}
          className="yds-spick-hub__filters yds-spick-hub__filters--sticky"
        />
      </div>

      <nav className="yds-spick-hub-quick" aria-label="추천 도구">
        <Link to="/stock-picks/ranking" className="yds-spick-hub-quick__link">
          AI 랭킹
        </Link>
        <Link to="/stock-picks/compare" className="yds-spick-hub-quick__link">
          종목 비교
        </Link>
        <Link to="/performance-validation/picks" className="yds-spick-hub-quick__link">
          상세 검증
        </Link>
        <Link to="/performance-validation/backtest" className="yds-spick-hub-quick__link">
          백테스트
        </Link>
        <Link to="/alert-center#pick-alerts" className="yds-spick-hub-quick__link">
          알림센터
          {pickAlerts.unread > 0 ? (
            <span className="yds-spick-hub-quick__badge">{pickAlerts.unread}</span>
          ) : null}
        </Link>
      </nav>

      <YdsStockPickTodayBriefing report={todayBriefing} />

      <section className="yds-spick-hub-today" aria-label="오늘의 추천">
        <h2 className="yds-spick-section__title yds-spick-section__title--tier">② 오늘의 추천</h2>
        <YdsStockPickMarketRegimeBanner
          ctx={marketContext}
          displayLimit={regimeLimit}
          compact
        />
        <YdsStockPickTodaySignal
          stocks={liveStocks}
          loading={loading && !liveStocks.length}
          embedded
        />
      </section>

      <YdsStockPickFavoriteAlerts alerts={favoriteAlerts} />

      <YdsStockPickSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        resultCount={searchResultCount}
      />

      <YdsStockPickCountryTabs
        countryId={countryId}
        onCountryChange={(id) => {
          setCountryId(id)
          setListFilters((prev) => ({ ...prev, country: id }))
        }}
        className="yds-spick-country-tabs--mobile"
        counts={{
          US: stocksByCountry.US.length,
          KR: stocksByCountry.KR.length,
        }}
      />

      <div className="yds-spick-dual" ref={dualRef}>
        {initialLoading ? (
          <YdsStockPickHubSkeleton rows={5} className="yds-spick-hub-skeleton--dual" />
        ) : (
        STOCK_PICK_COUNTRIES.map((country) => {
          const isActive = countryId === country.id
          const panelId =
            country.id === "US" ? "spick-all-us" : "spick-all-kr"
          const mountPanel = dualLayout || isActive

          return (
            <div
              key={country.id}
              className={[
                "yds-spick-dual__col",
                isActive ? "yds-spick-dual__col--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              role="tabpanel"
              aria-label={`${country.label} 종목추천`}
              aria-hidden={dualLayout ? false : !isActive}
            >
              {mountPanel ? (
              <YdsStockPickCountryPanel
                countryId={country.id}
                stocks={stocksByCountry[country.id]}
                filters={listFilters}
                onFiltersChange={handleListFiltersChange}
                isFavorite={isFavorite}
                onToggleFavorite={toggleFavorite}
                heldTickers={heldTickers}
                showCountryHead
                allSectionId={panelId}
                loading={loading && !stocksByCountry[country.id].length}
                regimeLimit={regimeLimit}
                filterResultCount={country.id === countryId ? filteredActiveCount : undefined}
              />
              ) : null}
            </div>
          )
        })
        )}
      </div>

      <YdsStockPickHubExtras
        stocks={activeStocks}
        regimeStocks={activeRegimeStocks}
        universeStocks={universeByCountry[countryId]}
        sectorId={sectorByCountry[countryId]}
        onSectorChange={(id) => setSectorForCountry(countryId, id)}
        regimeLimit={regimeLimit}
        portfolioStocks={usPortfolioStocks}
        heldTickers={heldTickers}
        loading={loading && !activeStocks.length}
      />

      <YdsRecommendPerformanceReport
        className="yds-spick-hub__perf-report"
        refreshKey={validationRevision}
        stocks={liveStocks}
      />

      <YdsStockPickHubHistory report={hubHistory} />
    </div>
  )
}
