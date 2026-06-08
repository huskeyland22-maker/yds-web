import { useEffect, useMemo, useState } from "react"
import {
  assignRanks,
  filterByCountry,
  getStockPickUniverse,
  STOCK_PICK_COUNTRIES,
} from "../../content/ydsStockPickModel.js"
import { useStockPickFavorites } from "../../hooks/useStockPickFavorites.js"
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
  const allStocks = useMemo(() => getStockPickUniverse(), [])
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
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
