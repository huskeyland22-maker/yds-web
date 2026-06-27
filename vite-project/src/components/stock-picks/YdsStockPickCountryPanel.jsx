import { useMemo } from "react"
import {
  STOCK_PICK_COUNTRIES,
} from "../../content/ydsStockPickModel.js"
import { getRegimeTopStocks } from "../../content/ydsStockPickMarketRegime.js"
import YdsStockPickTop3 from "./YdsStockPickTop3.jsx"
import YdsStockPickAllTable from "./YdsStockPickAllTable.jsx"

/**
 * @param {{
 *   countryId: import("../../content/ydsStockPickModel.js").StockPickCountryId
 *   stocks: import("../../content/ydsStockPickModel.js").StockPickView[]
 *   filters: import("../../content/ydsStockPickFilterEngine.js").StockPickFilterState
 *   onFiltersChange: (f: import("../../content/ydsStockPickFilterEngine.js").StockPickFilterState) => void
 *   isFavorite: (ticker: string) => boolean
 *   onToggleFavorite: (ticker: string) => void
 *   heldTickers?: Set<string>
 *   showCountryHead?: boolean
 *   allSectionId?: string
 *   loading?: boolean
 *   regimeLimit?: number
 *   showTableFilters?: boolean
 *   filterResultCount?: number
 * }} props
 */
export default function YdsStockPickCountryPanel({
  countryId,
  stocks,
  filters,
  onFiltersChange,
  isFavorite,
  onToggleFavorite,
  heldTickers = new Set(),
  showCountryHead = false,
  allSectionId = "spick-all",
  loading = false,
  regimeLimit = 5,
  showTableFilters = false,
  filterResultCount,
}) {
  const countryMeta = STOCK_PICK_COUNTRIES.find((c) => c.id === countryId)

  const topHero = useMemo(
    () => getRegimeTopStocks(stocks, Math.min(regimeLimit, 5)),
    [stocks, regimeLimit],
  )

  return (
    <div className="yds-spick-country-panel" data-country={countryId}>
      {showCountryHead && countryMeta ? (
        <header className="yds-spick-country-panel__head yds-spick-country-panel__head--inline">
          <span className="yds-spick-country-panel__emoji" aria-hidden>
            {countryMeta.emoji}
          </span>
          <h2 className="yds-spick-country-panel__title">{countryMeta.label}</h2>
        </header>
      ) : null}

      <div className="yds-spick-country-panel__zone-hero" data-spick-zone="hero">
        <YdsStockPickTop3
          stocks={topHero}
          isFavorite={isFavorite}
          onToggleFavorite={onToggleFavorite}
          heldTickers={heldTickers}
          loading={loading}
          sectionId={`${allSectionId}-top5`}
        />
      </div>

      <div className="yds-spick-country-panel__zone-all" data-spick-zone="all">
        <YdsStockPickAllTable
          stocks={stocks}
          filters={filters}
          onFiltersChange={onFiltersChange}
          isFavorite={isFavorite}
          sectionId={allSectionId}
          loading={loading}
          showFilters={showTableFilters}
          filterResultCount={filterResultCount}
        />
      </div>
    </div>
  )
}
