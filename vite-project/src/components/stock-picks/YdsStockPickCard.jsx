import { Link } from "react-router-dom"
import YdsStockPickFavoriteButton from "./YdsStockPickFavoriteButton.jsx"
import YdsStockPickActionBlock from "./YdsStockPickActionBlock.jsx"
import YdsStockPickPriceLine from "./YdsStockPickPriceLine.jsx"
import YdsStockPickReasons from "./YdsStockPickReasons.jsx"

/**
 * @param {{
 *   stock: import("../../content/ydsStockPickModel.js").StockPickView
 *   variant?: 'default' | 'top3' | 'top5' | 'compact'
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
  const isHero = variant === "top3" || variant === "top5"
  const isCompact = variant === "compact"

  return (
    <Link
      to={to}
      className={[
        "yds-spick-card",
        isHero ? "yds-spick-card--top5" : "",
        isCompact ? "yds-spick-card--compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="yds-spick-card__head">
        {medal ? <span className="yds-spick-card__medal">{medal}</span> : null}
        {rankLabel && !isHero ? (
          <span className="yds-spick-card__rank">{rankLabel}</span>
        ) : null}
        <YdsStockPickFavoriteButton
          active={isFavorite}
          onToggle={() => onToggleFavorite(stock.ticker)}
        />
      </div>

      <h3 className="yds-spick-card__name">{stock.name}</h3>
      <YdsStockPickPriceLine stock={stock} compact={isCompact} />

      <YdsStockPickActionBlock
        stock={stock}
        variant={isHero ? "top5" : isCompact ? "compact" : "card"}
      />

      <YdsStockPickReasons
        reasons={stock.recommendReasons}
        variant={isHero ? "top3" : isCompact ? "inline" : "card"}
        maxItems={isHero || isCompact ? 1 : undefined}
        title={isHero || isCompact ? "" : "추천 이유"}
      />
    </Link>
  )
}
