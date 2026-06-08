import { Link } from "react-router-dom"
import YdsStockPickFavoriteButton from "./YdsStockPickFavoriteButton.jsx"
import YdsStockScoreBreakdown from "./YdsStockScoreBreakdown.jsx"

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
  const showBreakdown = variant !== "compact"

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

      {showBreakdown ? (
        <YdsStockScoreBreakdown
          scores={stock.scores}
          rows={stock.scoreRows}
          variant={variant === "top3" ? "detail" : "card"}
        />
      ) : (
        <p className="yds-spick-card__score-mini font-mono tabular-nums">
          YDS {stock.scores.totalScore}
        </p>
      )}

      <p className="yds-spick-card__status-label">상태</p>
      <p className="yds-spick-card__status">{stock.statusPhrase}</p>

      {showBreakdown ? (
        <>
          <p className="yds-spick-card__eval-label">한줄 평가</p>
          <p className="yds-spick-card__comment">{stock.comment}</p>
        </>
      ) : null}
    </Link>
  )
}
