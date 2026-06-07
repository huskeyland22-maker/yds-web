import { STOCK_PICK_SECTORS } from "../../content/ydsStockPickModel.js"
import YdsStockPickCard from "./YdsStockPickCard.jsx"

/**
 * @param {{
 *   stocks: import("../../content/ydsStockPickModel.js").StockPickView[]
 *   sectorId: string
 *   onSectorChange: (id: string) => void
 *   isFavorite: (ticker: string) => boolean
 *   onToggleFavorite: (ticker: string) => void
 * }} props
 */
export default function YdsStockPickSectorPanel({
  stocks,
  sectorId,
  onSectorChange,
  isFavorite,
  onToggleFavorite,
}) {
  return (
    <section className="yds-spick-section" aria-labelledby="spick-sector">
      <h2 id="spick-sector" className="yds-spick-section__title">
        섹터별 보기
      </h2>

      <div className="yds-spick-tabs" role="tablist" aria-label="섹터 필터">
        {STOCK_PICK_SECTORS.map((sector) => (
          <button
            key={sector.id}
            type="button"
            role="tab"
            aria-selected={sectorId === sector.id}
            className={[
              "yds-spick-tabs__btn",
              sectorId === sector.id ? "yds-spick-tabs__btn--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onSectorChange(sector.id)}
          >
            {sector.label}
          </button>
        ))}
      </div>

      <div className="yds-spick-grid" role="tabpanel">
        {stocks.length ? (
          stocks.map((stock) => (
            <YdsStockPickCard
              key={stock.ticker}
              stock={stock}
              isFavorite={isFavorite(stock.ticker)}
              onToggleFavorite={onToggleFavorite}
            />
          ))
        ) : (
          <p className="yds-spick-empty">해당 섹터 종목이 없습니다.</p>
        )}
      </div>
    </section>
  )
}
