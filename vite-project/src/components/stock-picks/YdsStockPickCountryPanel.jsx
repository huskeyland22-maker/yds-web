import { useMemo, useState } from "react"
import {
  filterBySector,
  getTop5Stocks,
  STOCK_PICK_COUNTRIES,
} from "../../content/ydsStockPickModel.js"
import YdsStockPickTop3 from "./YdsStockPickTop3.jsx"
import YdsStockPickSectorPanel from "./YdsStockPickSectorPanel.jsx"
import YdsStockPickCard from "./YdsStockPickCard.jsx"

/**
 * @param {{
 *   countryId: import("../../content/ydsStockPickModel.js").StockPickCountryId
 *   stocks: import("../../content/ydsStockPickModel.js").StockPickView[]
 *   sectorId: string
 *   onSectorChange: (id: string) => void
 *   isFavorite: (ticker: string) => boolean
 *   onToggleFavorite: (ticker: string) => void
 *   showCountryHead?: boolean
 *   allSectionId?: string
 *   loading?: boolean
 * }} props
 */
export default function YdsStockPickCountryPanel({
  countryId,
  stocks,
  sectorId,
  onSectorChange,
  isFavorite,
  onToggleFavorite,
  showCountryHead = false,
  allSectionId = "spick-all",
  loading = false,
}) {
  const countryMeta = STOCK_PICK_COUNTRIES.find((c) => c.id === countryId)
  const [showAll, setShowAll] = useState(false)

  const top5 = useMemo(() => getTop5Stocks(stocks), [stocks])
  const sectorStocks = useMemo(
    () => filterBySector(stocks, sectorId),
    [stocks, sectorId],
  )

  return (
    <div className="yds-spick-country-panel">
      {showCountryHead && countryMeta ? (
        <header className="yds-spick-country-panel__head">
          <span className="yds-spick-country-panel__emoji" aria-hidden>
            {countryMeta.emoji}
          </span>
          <h2 className="yds-spick-country-panel__title">{countryMeta.label}</h2>
        </header>
      ) : null}

      <YdsStockPickTop3
        stocks={top5}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
        loading={loading}
      />

      <YdsStockPickSectorPanel
        stocks={sectorStocks}
        sectorId={sectorId}
        onSectorChange={onSectorChange}
      />

      <section className="yds-spick-section yds-spick-section--all" aria-labelledby={allSectionId}>
        <div className="yds-spick-section__head-row">
          <h2 id={allSectionId} className="yds-spick-section__title yds-spick-section__title--inline">
            전체 종목
          </h2>
          <button
            type="button"
            className="yds-spick-section__toggle"
            aria-expanded={showAll}
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "접기" : "전체 보기"}
          </button>
        </div>
        {showAll ? (
          <div className="yds-spick-grid yds-spick-grid--all">
            {stocks.map((stock) => (
              <YdsStockPickCard
                key={stock.ticker}
                stock={stock}
                variant="compact"
                isFavorite={isFavorite(stock.ticker)}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        ) : null}
        {showAll && !stocks.length ? (
          <p className="yds-spick-empty">표시할 종목이 없습니다.</p>
        ) : null}
      </section>
    </div>
  )
}
