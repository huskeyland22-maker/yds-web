import { useMemo } from "react"
import { Link } from "react-router-dom"
import { buildStockPickDeskPreview } from "../../content/ydsStockPickDeskPreview.js"

/**
 * @param {{
 *   stock: import("../../content/ydsStockPickModel.js").StockPickView
 * }} props
 */
export default function YdsMarketRecommendCard({ stock }) {
  const preview = useMemo(() => buildStockPickDeskPreview(stock), [stock])
  const to = `/stock-picks/${encodeURIComponent(stock.ticker)}`
  const retTone =
    preview.returnSinceRecommend != null && preview.returnSinceRecommend >= 0 ? "up" : "down"

  return (
    <article className="yds-market-rec-card">
      <Link to={to} className="yds-market-rec-card__link">
        <div className="yds-market-rec-card__head">
          <h3 className="yds-market-rec-card__name">{stock.name}</h3>
          <span
            className={`yds-market-rec-card__badge yds-market-rec-card__badge--${preview.badge.id}`}
          >
            {preview.badge.label}
          </span>
        </div>

        <dl className="yds-market-rec-card__prices">
          <div>
            <dt>현재가</dt>
            <dd className="font-mono tabular-nums">{preview.currentPriceDisplay}</dd>
          </div>
          <div>
            <dt>추천가</dt>
            <dd className="font-mono tabular-nums">{preview.recommendedPriceDisplay}</dd>
          </div>
        </dl>

        <div className="yds-market-rec-card__return">
          <span className="yds-market-rec-card__return-key">추천 후</span>
          <strong
            className={`yds-market-rec-card__return-val font-mono tabular-nums yds-market-rec-card__return-val--${retTone}`}
          >
            {preview.returnLabel}
          </strong>
        </div>
      </Link>
    </article>
  )
}
