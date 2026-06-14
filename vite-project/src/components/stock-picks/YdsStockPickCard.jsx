import { useMemo } from "react"
import { Link } from "react-router-dom"
import {
  buildStockPickTransparency,
  formatTransparencyPrice,
} from "../../content/ydsStockPickTransparency.js"
import YdsStockPickV7Signals from "./YdsStockPickV7Signals.jsx"
import YdsStockPickFavoriteButton from "./YdsStockPickFavoriteButton.jsx"
import YdsStockPickQualityTimingHeader from "./YdsStockPickQualityTimingHeader.jsx"
import YdsStockPickInsightStrip from "./YdsStockPickInsightStrip.jsx"
import YdsStockPickThemeBadges from "./YdsStockPickThemeBadges.jsx"
import YdsStockPickUxStatusBadge from "./YdsStockPickUxStatusBadge.jsx"

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
 *   rankIndex?: number
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
  rankIndex,
}) {
  if (stock.dataSource !== "live") {
    return null
  }

  const to = `/stock-picks/${encodeURIComponent(stock.ticker)}`
  const isHero = variant === "top3" || variant === "top5"
  const transparency = useMemo(() => buildStockPickTransparency(stock), [stock])
  const country = stock.country === "KR" ? "KR" : "US"
  const closeRaw = stock.snapshot?.price ?? stock.snapshot?.close
  const price = formatTransparencyPrice(closeRaw, country)

  const position52w = stock.statusDiag?.inputs?.position52w
  const positionLabel =
    position52w != null && Number.isFinite(position52w)
      ? `52주 ${Math.round(position52w)}%`
      : "—"
  const rankClass =
    rankIndex === 0
      ? "yds-spick-card--rank-1"
      : rankIndex === 1
        ? "yds-spick-card--rank-2"
        : rankIndex === 2
          ? "yds-spick-card--rank-3"
          : ""

  return (
    <article
      className={[
        "yds-spick-card",
        "yds-spick-card--live",
        isHero ? "yds-spick-card--top5" : "",
        rankClass,
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

        <YdsStockPickV7Signals stock={stock} variant={variant === "compact" ? "compact" : "default"} />

        <YdsStockPickThemeBadges themes={stock.investThemes ?? []} className="yds-spick-card__themes" />

        <YdsStockPickQualityTimingHeader
          stock={stock}
          variant="compact"
          showTotal={false}
        />

        <YdsStockPickInsightStrip stock={stock} />

        <div className="yds-spick-card__core">
          <YdsStockPickUxStatusBadge stock={stock} className="yds-spick-card__status" />
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
