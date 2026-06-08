import { useMemo } from "react"
import { Link } from "react-router-dom"
import { buildStockPickTransparency } from "../../content/ydsStockPickTransparency.js"
import YdsStockPickFavoriteButton from "./YdsStockPickFavoriteButton.jsx"
import YdsStockPickDataBadge from "./YdsStockPickDataBadge.jsx"
import YdsStockPickTransparencyPanel from "./YdsStockPickTransparencyPanel.jsx"
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
  const transparency = useMemo(
    () => (isHero || isCompact ? buildStockPickTransparency(stock) : null),
    [stock, isHero, isCompact],
  )

  return (
    <Link
      to={to}
      className={[
        "yds-spick-card",
        isHero ? "yds-spick-card--top5" : "",
        isCompact ? "yds-spick-card--compact" : "",
        transparency?.badge === "live" ? "yds-spick-card--live" : "yds-spick-card--fallback",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="yds-spick-card__head">
        {medal ? <span className="yds-spick-card__medal">{medal}</span> : null}
        {isHero && transparency ? (
          <span className="yds-spick-card__flag" aria-hidden>
            {transparency.countryFlag}
          </span>
        ) : null}
        {transparency ? (
          <YdsStockPickDataBadge mode={transparency.badge} />
        ) : (
          <YdsStockPickDataBadge mode={stock.dataSource === "live" ? "live" : "fallback"} />
        )}
        {rankLabel && !isHero ? (
          <span className="yds-spick-card__rank">{rankLabel}</span>
        ) : null}
        <YdsStockPickFavoriteButton
          active={isFavorite}
          onToggle={() => onToggleFavorite(stock.ticker)}
        />
      </div>

      <h3 className="yds-spick-card__name">{stock.name}</h3>

      {isHero ? (
        <YdsStockPickTransparencyPanel stock={stock} variant="top5" />
      ) : (
        <>
          <YdsStockPickPriceLine stock={stock} compact={isCompact} />
          {isCompact ? (
            <YdsStockPickTransparencyPanel stock={stock} variant="compact" />
          ) : (
            <>
              <YdsStockPickActionBlock stock={stock} variant="card" />
              <YdsStockPickReasons reasons={stock.recommendReasons} variant="card" />
            </>
          )}
        </>
      )}
    </Link>
  )
}
