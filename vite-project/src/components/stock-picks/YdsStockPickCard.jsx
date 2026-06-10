import { useMemo } from "react"
import { Link } from "react-router-dom"
import {
  buildStockPickTransparency,
  formatTransparencyPrice,
} from "../../content/ydsStockPickTransparency.js"
import YdsStockPickFavoriteButton from "./YdsStockPickFavoriteButton.jsx"

/**
 * @param {{
 *   stock: import("../../content/ydsStockPickModel.js").StockPickView
 *   variant?: 'default' | 'top3' | 'top5' | 'compact'
 *   medal?: string
 *   rankLabel?: string
 *   isFavorite: boolean
 *   onToggleFavorite: (ticker: string) => void
 *   isHeld?: boolean
 *   statusChange?: { fromLabel: string; toLabel: string } | null
 * }} props
 */
export default function YdsStockPickCard({
  stock,
  variant = "default",
  medal,
  rankLabel,
  isFavorite,
  onToggleFavorite,
  isHeld = false,
  statusChange = null,
}) {
  if (stock.dataSource !== "live") {
    return null
  }

  const to = `/stock-picks/${encodeURIComponent(stock.ticker)}`
  const isHero = variant === "top3" || variant === "top5"
  const transparency = useMemo(() => buildStockPickTransparency(stock), [stock])
  const country = stock.country === "KR" ? "KR" : "US"
  const closeRaw = stock.quote?.price ?? stock.snapshot?.close ?? stock.snapshot?.price
  const price = formatTransparencyPrice(closeRaw, country)

  const position52w = stock.statusDiag?.inputs?.position52w
  const positionLabel =
    position52w != null && Number.isFinite(position52w)
      ? `52주 ${Math.round(position52w)}%`
      : "—"

  return (
    <article
      className={[
        "yds-spick-card",
        "yds-spick-card--live",
        isHero ? "yds-spick-card--top5" : "",
        variant === "compact" ? "yds-spick-card--compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="yds-spick-card__head">
        {medal ? <span className="yds-spick-card__medal">{medal}</span> : null}
        {rankLabel && !isHero ? (
          <span className="yds-spick-card__rank">{rankLabel}</span>
        ) : null}
        <div className="yds-spick-card__badges">
          {isHeld ? <span className="yds-spick-card__held">🟦 보유중</span> : null}
          {isFavorite ? <span className="yds-spick-card__fav-mark">⭐</span> : null}
        </div>
        <YdsStockPickFavoriteButton
          active={isFavorite}
          onToggle={() => onToggleFavorite(stock.ticker)}
        />
      </div>

      <Link to={to} className="yds-spick-card__link">
        <h3 className="yds-spick-card__name">{stock.name}</h3>

        <div className="yds-spick-card__core">
          <p className="yds-spick-card__status">
            <span aria-hidden>{stock.stockStatus.emoji}</span> {stock.stockStatus.label}
          </p>
          <p className="yds-spick-card__price font-mono tabular-nums">{price}</p>
        </div>

        {statusChange ? (
          <p className="yds-spick-card__status-change">
            {statusChange.fromLabel} → {statusChange.toLabel}
          </p>
        ) : null}
      </Link>

      <details className="yds-spick-card__details">
        <summary className="yds-spick-card__details-summary">상세</summary>
        <dl className="yds-spick-card__details-grid">
          <div>
            <dt>20일선</dt>
            <dd className="font-mono tabular-nums">
              {transparency.metrics.find((m) => m.id === "ma20")?.value ?? "—"}
            </dd>
          </div>
          <div>
            <dt>60일선</dt>
            <dd className="font-mono tabular-nums">
              {transparency.metrics.find((m) => m.id === "ma60")?.value ?? "—"}
            </dd>
          </div>
          <div>
            <dt>거래량</dt>
            <dd>{transparency.metrics.find((m) => m.id === "volume")?.value ?? "—"}</dd>
          </div>
          <div>
            <dt>52주 위치</dt>
            <dd className="font-mono tabular-nums">{positionLabel}</dd>
          </div>
          <div className="yds-spick-card__details-wide">
            <dt>추천 이유</dt>
            <dd>{stock.recommendReasonSummary || stock.recommendReasons[0]?.text || "—"}</dd>
          </div>
          {stock.quoteSource ? (
            <div className="yds-spick-card__details-wide">
              <dt>Source</dt>
              <dd>{stock.quoteSource}</dd>
            </div>
          ) : null}
        </dl>
      </details>
    </article>
  )
}
