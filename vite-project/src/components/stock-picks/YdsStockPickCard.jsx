import { Link } from "react-router-dom"
import YdsStockPickFavoriteButton from "./YdsStockPickFavoriteButton.jsx"
import YdsStockPickActionBlock from "./YdsStockPickActionBlock.jsx"
import YdsStockPickReasons from "./YdsStockPickReasons.jsx"

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
  const isTop3 = variant === "top3"
  const isCompact = variant === "compact"

  return (
    <Link
      to={to}
      className={[
        "yds-spick-card",
        isTop3 ? "yds-spick-card--top3" : "",
        isCompact ? "yds-spick-card--compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="yds-spick-card__head">
        {medal ? <span className="yds-spick-card__medal">{medal}</span> : null}
        {rankLabel && !isTop3 ? (
          <span className="yds-spick-card__rank">{rankLabel}</span>
        ) : null}
        <YdsStockPickFavoriteButton
          active={isFavorite}
          onToggle={() => onToggleFavorite(stock.ticker)}
        />
      </div>

      <h3 className="yds-spick-card__name">{stock.name}</h3>
      {!isCompact ? (
        <p className="yds-spick-card__ticker font-mono tabular-nums">{stock.ticker}</p>
      ) : null}

      {isTop3 ? (
        <>
          <p className="yds-spick-card__top3-action">
            <span aria-hidden>{stock.stockAction.emoji}</span> {stock.stockAction.label}
          </p>
          <p className="yds-spick-card__top3-score font-mono tabular-nums">
            YDS {stock.scores.totalScore}
          </p>
        </>
      ) : (
        <YdsStockPickActionBlock
          stock={stock}
          variant={isCompact ? "inline" : "card"}
        />
      )}

      <YdsStockPickReasons
        reasons={stock.recommendReasons}
        variant={isTop3 ? "top3" : isCompact ? "inline" : "card"}
      />

      {!isTop3 && !isCompact ? (
        <>
          <p className="yds-spick-card__eval-label">한줄 평가</p>
          <p className="yds-spick-card__comment">{stock.comment}</p>
        </>
      ) : null}
    </Link>
  )
}
