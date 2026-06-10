import { useEffect, useMemo, useState } from "react"
import { captureTodayPickSnapshots } from "../../content/ydsValidationEngine.js"
import {
  assignRanks,
  filterByCountry,
  STOCK_PICK_COUNTRIES,
} from "../../content/ydsStockPickModel.js"
import { markFirstRender, recordSearchFilterMs } from "../../content/ydsStockPickPerf.js"
import { recordRenderPhase } from "../../content/ydsStockPickRenderPerf.js"
import { filterStockPicksByQuery } from "../../content/ydsStockPickSearch.js"
import { useStockPickFavorites } from "../../hooks/useStockPickFavorites.js"
import { useStockPickLiveData } from "../../hooks/useStockPickLiveData.js"
import { useYdsMarketContext } from "../../hooks/useYdsMarketContext.js"
import { useStockPickHeldTickers } from "../../hooks/useStockPickHeldTickers.js"
import { useStockPickStatusChanges } from "../../hooks/useStockPickStatusChanges.js"
import YdsStockPickDebugBox from "./YdsStockPickDebugBox.jsx"
import YdsStockPickLoadBanner from "./YdsStockPickLoadBanner.jsx"
import YdsStockPickSearchBar from "./YdsStockPickSearchBar.jsx"
import YdsStockPickCountryTabs from "./YdsStockPickCountryTabs.jsx"
import YdsStockPickCountryPanel from "./YdsStockPickCountryPanel.jsx"

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
  const dualLayout = useDualCountryLayout()
  const marketContext = useYdsMarketContext()
  const {
    stocks: liveStocks,
    loadStats,
    pipelineDebug,
    loading,
    refreshing,
    fromCache,
    lastSyncAt,
  } = useStockPickLiveData(marketContext)
  const heldTickers = useStockPickHeldTickers()
  const statusChanges = useStockPickStatusChanges(liveStocks)

  useEffect(() => {
    if (loading || !liveStocks.length) return
    const run = () => captureTodayPickSnapshots(marketContext, 10, liveStocks)
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(run, { timeout: 3000 })
      return () => cancelIdleCallback(id)
    }
    const id = setTimeout(run, 0)
    return () => clearTimeout(id)
  }, [marketContext, loading, liveStocks])

  const {
    favoritesOnly,
    setFavoritesOnly,
    isFavorite,
    toggleFavorite,
    applyFavoriteFilter,
    favoriteCount,
  } = useStockPickFavorites()

  const [countryId, setCountryId] = useState("US")
  const [sectorByCountry, setSectorByCountry] = useState(INITIAL_SECTOR)
  const [searchQuery, setSearchQuery] = useState("")

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
      US: applyFavoriteFilter(ranked.US),
      KR: applyFavoriteFilter(ranked.KR),
    }
  }, [searchedStocks, applyFavoriteFilter])

  useEffect(() => {
    if (stocksByCountry.US.length || stocksByCountry.KR.length) {
      markFirstRender()
    }
  }, [stocksByCountry.US.length, stocksByCountry.KR.length])

  const setSectorForCountry = (country, sectorId) => {
    setSectorByCountry((prev) => ({ ...prev, [country]: sectorId }))
  }

  const debugView = useMemo(
    () => ({
      ...pipelineDebug,
      displayUs: stocksByCountry.US.length,
      displayKr: stocksByCountry.KR.length,
      favoritesOnly,
      fromCache,
      refreshing,
    }),
    [
      pipelineDebug,
      stocksByCountry.US.length,
      stocksByCountry.KR.length,
      favoritesOnly,
      fromCache,
      refreshing,
    ],
  )

  const searchResultCount = searchedStocks.length

  return (
    <div className="yds-spick-platform">
      <YdsStockPickDebugBox debug={debugView} loading={loading && !liveStocks.length} />
      <YdsStockPickLoadBanner stats={loadStats} loading={loading && !liveStocks.length} />
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

      <YdsStockPickSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        resultCount={searchResultCount}
      />

      <div className="yds-spick-toolbar">
        <button
          type="button"
          className={[
            "yds-spick-toolbar__btn",
            favoritesOnly ? "yds-spick-toolbar__btn--active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-pressed={favoritesOnly}
          onClick={() => setFavoritesOnly((v) => !v)}
        >
          {favoritesOnly ? "⭐ 관심종목만" : "☆ 관심종목만 보기"}
          {favoriteCount > 0 ? (
            <span className="yds-spick-toolbar__count font-mono tabular-nums">{favoriteCount}</span>
          ) : null}
        </button>
      </div>

      <YdsStockPickCountryTabs
        countryId={countryId}
        onCountryChange={setCountryId}
        className="yds-spick-country-tabs--mobile"
        counts={{
          US: stocksByCountry.US.length,
          KR: stocksByCountry.KR.length,
        }}
      />

      <div className="yds-spick-dual">
        {STOCK_PICK_COUNTRIES.map((country) => {
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
                sectorId={sectorByCountry[country.id]}
                onSectorChange={(id) => setSectorForCountry(country.id, id)}
                isFavorite={isFavorite}
                onToggleFavorite={toggleFavorite}
                heldTickers={heldTickers}
                statusChanges={statusChanges}
                showCountryHead
                allSectionId={panelId}
                loading={loading && !stocksByCountry[country.id].length}
              />
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
