import { TOP3_MEDALS } from "../../content/ydsStockPickModel.js"
import YdsStockPickCard from "./YdsStockPickCard.jsx"

/**
 * @param {{
 *   stocks: import("../../content/ydsStockPickModel.js").StockPickView[]
 *   isFavorite: (ticker: string) => boolean
 *   onToggleFavorite: (ticker: string) => void
 * }} props
 */
export default function YdsStockPickTop3({ stocks, isFavorite, onToggleFavorite }) {
  if (!stocks.length) return null

  return (
    <section className="yds-spick-section" aria-labelledby="spick-top3">
      <h2 id="spick-top3" className="yds-spick-section__title">
        오늘의 TOP3
      </h2>
      <div className="yds-spick-top3">
        {stocks.map((stock, index) => (
          <YdsStockPickCard
            key={stock.ticker}
            stock={stock}
            variant="top3"
            medal={TOP3_MEDALS[index]}
            rankLabel={`${index + 1}위`}
            isFavorite={isFavorite(stock.ticker)}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </section>
  )
}
