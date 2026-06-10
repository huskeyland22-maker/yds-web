import { TOP5_MEDALS } from "../../content/ydsStockPickModel.js"
import YdsStockPickCard from "./YdsStockPickCard.jsx"

/**
 * @param {{
 *   stocks: import("../../content/ydsStockPickModel.js").StockPickView[]
 *   isFavorite: (ticker: string) => boolean
 *   onToggleFavorite: (ticker: string) => void
 *   heldTickers?: Set<string>
 *   statusChanges?: Map<string, { fromLabel: string; toLabel: string }>
 *   loading?: boolean
 * }} props
 */
export default function YdsStockPickTop3({
  stocks,
  isFavorite,
  onToggleFavorite,
  heldTickers = new Set(),
  statusChanges = new Map(),
  loading,
}) {
  return (
    <section className="yds-spick-section yds-spick-section--hero" aria-labelledby="spick-top5">
      <h2 id="spick-top5" className="yds-spick-section__title">
        오늘의 TOP5
      </h2>
      {loading && !stocks.length ? (
        <p className="yds-spick-empty">시세 조회 중…</p>
      ) : null}
      {stocks.length ? (
        <div className="yds-spick-top5">
          {stocks.map((stock, index) => (
            <YdsStockPickCard
              key={stock.ticker}
              stock={stock}
              variant="top5"
              medal={TOP5_MEDALS[index]}
              isFavorite={isFavorite(stock.ticker)}
              onToggleFavorite={onToggleFavorite}
              isHeld={heldTickers.has(stock.ticker.toUpperCase())}
              statusChange={statusChanges.get(stock.ticker) ?? null}
            />
          ))}
        </div>
      ) : !loading ? (
        <p className="yds-spick-empty">표시할 종목이 없습니다.</p>
      ) : null}
    </section>
  )
}
