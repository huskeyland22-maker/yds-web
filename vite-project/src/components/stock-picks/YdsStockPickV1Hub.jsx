import { useMemo, useState } from "react"
import {
  filterBySector,
  getRankingStocks,
  getStockPickUniverse,
  getTop3Stocks,
} from "../../content/ydsStockPickModel.js"
import { useStockPickFavorites } from "../../hooks/useStockPickFavorites.js"
import YdsStockPickTop3 from "./YdsStockPickTop3.jsx"
import YdsStockPickRanking from "./YdsStockPickRanking.jsx"
import YdsStockPickSectorPanel from "./YdsStockPickSectorPanel.jsx"
import YdsStockPickCard from "./YdsStockPickCard.jsx"

export default function YdsStockPickV1Hub() {
  const allStocks = useMemo(() => getStockPickUniverse(), [])
  const {
    favoritesOnly,
    setFavoritesOnly,
    isFavorite,
    toggleFavorite,
    applyFavoriteFilter,
    favoriteCount,
  } = useStockPickFavorites()

  const [sectorId, setSectorId] = useState("all")

  const visible = useMemo(() => applyFavoriteFilter(allStocks), [allStocks, applyFavoriteFilter])
  const top3 = useMemo(() => getTop3Stocks(visible), [visible])
  const ranking = useMemo(() => getRankingStocks(visible, 5), [visible])
  const sectorStocks = useMemo(
    () => filterBySector(visible, sectorId),
    [visible, sectorId],
  )

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

      <YdsStockPickTop3
        stocks={top3}
        isFavorite={isFavorite}
        onToggleFavorite={toggleFavorite}
      />

      <YdsStockPickRanking stocks={ranking} />

      <YdsStockPickSectorPanel
        stocks={sectorStocks}
        sectorId={sectorId}
        onSectorChange={setSectorId}
        isFavorite={isFavorite}
        onToggleFavorite={toggleFavorite}
      />

      <section className="yds-spick-section" aria-labelledby="spick-all">
        <h2 id="spick-all" className="yds-spick-section__title">
          전체 종목
        </h2>
        <div className="yds-spick-grid yds-spick-grid--all">
          {visible.map((stock) => (
            <YdsStockPickCard
              key={stock.ticker}
              stock={stock}
              variant="compact"
              isFavorite={isFavorite(stock.ticker)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
        {!visible.length ? <p className="yds-spick-empty">표시할 종목이 없습니다.</p> : null}
      </section>
    </div>
  )
}
