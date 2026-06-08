import { useMemo } from "react"
import {
  filterBySector,
  getRankingStocks,
  getTop3Stocks,
  STOCK_PICK_COUNTRIES,
} from "../../content/ydsStockPickModel.js"
import YdsStockPickTop3 from "./YdsStockPickTop3.jsx"
import YdsStockPickRanking from "./YdsStockPickRanking.jsx"
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
}) {
  const countryMeta = STOCK_PICK_COUNTRIES.find((c) => c.id === countryId)

  const top3 = useMemo(() => getTop3Stocks(stocks), [stocks])
  const ranking = useMemo(() => getRankingStocks(stocks, 5), [stocks])
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
        stocks={top3}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
      />

      <YdsStockPickRanking stocks={ranking} />

      <YdsStockPickSectorPanel
        stocks={sectorStocks}
        sectorId={sectorId}
        onSectorChange={onSectorChange}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
      />

      <section className="yds-spick-section" aria-labelledby={allSectionId}>
        <h2 id={allSectionId} className="yds-spick-section__title">
          전체 종목
        </h2>
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
        {!stocks.length ? <p className="yds-spick-empty">표시할 종목이 없습니다.</p> : null}
      </section>
    </div>
  )
}
