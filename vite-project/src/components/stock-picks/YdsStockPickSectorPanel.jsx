import { useLayoutEffect, useRef } from "react"
import { Link } from "react-router-dom"
import { STOCK_PICK_SECTORS } from "../../content/ydsStockPickModel.js"
import { formatTransparencyPrice } from "../../content/ydsStockPickTransparency.js"
import { getStockPickTotalScore } from "../../content/ydsStockPickUxStatus.js"
import { recordComponentMount } from "../../content/ydsStockPickRenderPerf.js"
import YdsStockPickUxStatusBadge from "./YdsStockPickUxStatusBadge.jsx"

/**
 * @param {{
 *   stocks: import("../../content/ydsStockPickModel.js").StockPickView[]
 *   allStocks: import("../../content/ydsStockPickModel.js").StockPickView[]
 *   sectorId: string
 *   onSectorChange: (id: string) => void
 *   heldTickers?: Set<string>
 * }} props
 */
export default function YdsStockPickSectorPanel({
  stocks,
  allStocks,
  sectorId,
  onSectorChange,
  heldTickers = new Set(),
}) {
  const mountT0 = useRef(performance.now())

  useLayoutEffect(() => {
    recordComponentMount("sector", performance.now() - mountT0.current, {
      count: stocks.length,
    })
  }, [stocks.length])

  const sectorCounts = STOCK_PICK_SECTORS.reduce((acc, sector) => {
    if (sector.id === "all") {
      acc[sector.id] = allStocks.length
    } else {
      acc[sector.id] = allStocks.filter((s) => s.sector === sector.id).length
    }
    return acc
  }, /** @type {Record<string, number>} */ ({}))

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
            {sector.label} ({sectorCounts[sector.id] ?? 0})
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
                  {heldTickers.has(stock.ticker.toUpperCase()) ? (
                    <span className="yds-spick-sector-list__held">보유</span>
                  ) : null}
                </span>
                <span className="yds-spick-sector-list__score font-mono tabular-nums">
                  {getStockPickTotalScore(stock) ?? "—"}
                </span>
                <span className="yds-spick-sector-list__status">
                  <YdsStockPickUxStatusBadge stock={stock} />
                </span>
                <span className="yds-spick-sector-list__price font-mono tabular-nums">
                  {formatTransparencyPrice(
                    stock.snapshot?.price ?? stock.snapshot?.close,
                    stock.country === "KR" ? "KR" : "US",
                  )}
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
