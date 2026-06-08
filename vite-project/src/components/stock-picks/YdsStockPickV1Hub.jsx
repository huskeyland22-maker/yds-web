import { useEffect, useMemo, useState } from "react"
import { captureTodayPickSnapshots } from "../../content/ydsValidationEngine.js"
import {
  assignRanks,
  filterByCountry,
  STOCK_PICK_COUNTRIES,
} from "../../content/ydsStockPickModel.js"
import { useStockPickFavorites } from "../../hooks/useStockPickFavorites.js"
import { useStockPickLiveData } from "../../hooks/useStockPickLiveData.js"
import { useYdsMarketContext } from "../../hooks/useYdsMarketContext.js"
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
  const { stocks: allStocks, loading, errors, lastSyncAt, liveReady } =
    useStockPickLiveData(marketContext)

  useEffect(() => {
    if (loading || !allStocks.length) return
    captureTodayPickSnapshots(marketContext, 10, allStocks)
  }, [marketContext, loading, allStocks])
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

  const stocksByCountry = useMemo(() => {
    const ranked = {
      US: assignRanks(filterByCountry(allStocks, "US")),
      KR: assignRanks(filterByCountry(allStocks, "KR")),
    }
    return {
      US: applyFavoriteFilter(ranked.US),
      KR: applyFavoriteFilter(ranked.KR),
    }
  }, [allStocks, applyFavoriteFilter])

  const setSectorForCountry = (country, sectorId) => {
    setSectorByCountry((prev) => ({ ...prev, [country]: sectorId }))
  }

  return (
    <div className="yds-spick-platform">
      {!loading && (errors.length > 0 || liveReady) ? (
        <p className="yds-spick-sync-note" role="status">
          {liveReady ? "실시간 시세 반영" : "오프라인 폴백"}
          {errors.length > 0 ? ` · 조회 실패 ${errors.length}건` : ""}
          {lastSyncAt ? ` · ${new Date(lastSyncAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })}` : ""}
        </p>
      ) : null}
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
          {favoritesOnly ? "⭐ 즐겨찾기만" : "☆ 즐겨찾기만 보기"}
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
              <YdsStockPickCountryPanel
                countryId={country.id}
                stocks={stocksByCountry[country.id]}
                sectorId={sectorByCountry[country.id]}
                onSectorChange={(id) => setSectorForCountry(country.id, id)}
                isFavorite={isFavorite}
                onToggleFavorite={toggleFavorite}
                showCountryHead
                allSectionId={panelId}
                loading={loading}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
