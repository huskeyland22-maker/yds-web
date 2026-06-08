import { Link } from "react-router-dom"
import { STOCK_PICK_SECTORS } from "../../content/ydsStockPickModel.js"
import YdsStockPickDataBadge from "./YdsStockPickDataBadge.jsx"

/**
 * @param {{
 *   stocks: import("../../content/ydsStockPickModel.js").StockPickView[]
 *   sectorId: string
 *   onSectorChange: (id: string) => void
 * }} props
 */
export default function YdsStockPickSectorPanel({ stocks, sectorId, onSectorChange }) {
  return (
    <section className="yds-spick-section yds-spick-section--sector" aria-labelledby="spick-sector">
      <h2 id="spick-sector" className="yds-spick-section__title">
        섹터 보기
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

      <ul className="yds-spick-sector-list" role="tabpanel">
        {stocks.length ? (
          stocks.map((stock) => (
            <li key={stock.ticker} className="yds-spick-sector-list__item">
              <Link
                to={`/stock-picks/${encodeURIComponent(stock.ticker)}`}
                className="yds-spick-sector-list__link"
              >
                <span className="yds-spick-sector-list__name">
                  {stock.name}
                  <YdsStockPickDataBadge
                    mode={stock.dataSource === "live" ? "live" : "fallback"}
                  />
                </span>
                <span className="yds-spick-sector-list__status">
                  <span aria-hidden>{stock.stockStatus.emoji}</span> {stock.stockStatus.label}
                </span>
                <span className="yds-spick-sector-list__action">
                  <span aria-hidden>{stock.stockAction.emoji}</span> {stock.stockAction.label}
                </span>
              </Link>
            </li>
          ))
        ) : (
          <li className="yds-spick-empty">해당 섹터 종목이 없습니다.</li>
        )}
      </ul>
    </section>
  )
}
