import { Link } from "react-router-dom"
import YdsStockPickFavoriteButton from "./YdsStockPickFavoriteButton.jsx"

/**
 * @param {{
 *   stock: import("../../content/ydsStockPickModel.js").StockPickView
 *   variant?: 'default' | 'top3' | 'compact'
 *   medal?: string
 *   rankLabel?: string
 *   isFavorite: boolean
 *   onToggleFavorite: (ticker: string) => void
 * }} props
 */
export default function YdsStockPickCard({
  stock,
  variant = "default",
  medal,
  rankLabel,
  isFavorite,
  onToggleFavorite,
}) {
  const to = `/stock-picks/${encodeURIComponent(stock.ticker)}`

  return (
    <Link
      to={to}
      className={[
        "yds-spick-card",
        variant === "top3" ? "yds-spick-card--top3" : "",
        variant === "compact" ? "yds-spick-card--compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="yds-spick-card__head">
        {medal ? <span className="yds-spick-card__medal">{medal}</span> : null}
        {rankLabel ? <span className="yds-spick-card__rank">{rankLabel}</span> : null}
        <YdsStockPickFavoriteButton
          active={isFavorite}
          onToggle={() => onToggleFavorite(stock.ticker)}
        />
      </div>

      <p className="yds-spick-card__stars">{stock.stars}</p>
      <h3 className="yds-spick-card__name">{stock.name}</h3>
      <p className="yds-spick-card__ticker font-mono tabular-nums">{stock.ticker}</p>
      <p className="yds-spick-card__status">
        {stock.statusView.emoji} {stock.statusView.label}
      </p>
      {variant !== "compact" ? (
        <p className="yds-spick-card__comment">{stock.comment}</p>
      ) : null}
    </Link>
  )
}
