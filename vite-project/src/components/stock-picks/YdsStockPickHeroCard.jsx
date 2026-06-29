import { Link } from "react-router-dom"
import YdsStockPickFavoriteButton from "./YdsStockPickFavoriteButton.jsx"
import YdsStockPickRecommendRationale from "./YdsStockPickRecommendRationale.jsx"
import YdsStockPickRecommendStatusBadge from "./YdsStockPickRecommendStatusBadge.jsx"
import YdsStockPickActionGuide from "./YdsStockPickActionGuide.jsx"
import { buildStockPickListRow } from "../../content/ydsStockPickListView.js"

/**
 * GO #87 — 현재수익 우선 강조 레이아웃
 * @param {{
 *   stock: import("../../content/ydsStockPickModel.js").StockPickView
 *   medal?: string
 *   rankIndex?: number
 *   isFavorite: boolean
 *   onToggleFavorite: (ticker: string) => void
 *   isHeld?: boolean
 * }} props
 */
export default function YdsStockPickHeroCard({
  stock,
  medal,
  rankIndex,
  isFavorite,
  onToggleFavorite,
  isHeld = false,
}) {
  const trust = stock.trustReport
  const row = buildStockPickListRow(stock)
  const to = `/stock-picks/${encodeURIComponent(stock.ticker)}`
  const confLabel = row.confidenceTier?.label ?? "—"
  const retTone =
    row.returnPct == null ? "muted" : row.returnPct >= 0 ? "up" : "down"

  const rankClass =
    rankIndex === 0
      ? "yds-spick-hero-card--rank-1"
      : rankIndex === 1
        ? "yds-spick-hero-card--rank-2"
        : rankIndex === 2
          ? "yds-spick-hero-card--rank-3"
          : ""

  return (
    <article
      className={[
        "yds-spick-hero-card",
        "yds-spick-hero-card--why",
        "yds-spick-hero-card--compact",
        "yds-spick-hero-card--priority",
        rankClass,
        isHeld ? "yds-spick-hero-card--held" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="yds-spick-hero-card__head">
        {medal ? <span className="yds-spick-hero-card__medal">{medal}</span> : null}
        <Link to={to} className="yds-spick-hero-card__name-link">
          <h3 className="yds-spick-hero-card__name">{stock.name}</h3>
        </Link>
        <div className="yds-spick-hero-card__tools">
          {isHeld ? <span className="yds-spick-hero-card__held">보유</span> : null}
          <YdsStockPickFavoriteButton
            active={isFavorite}
            onToggle={() => onToggleFavorite(stock.ticker)}
          />
        </div>
      </div>

      <YdsStockPickRecommendStatusBadge stock={stock} compact className="yds-spick-hero-card__status" />

      <div className="yds-spick-hero-card__hero-return">
        <span className="yds-spick-hero-card__hero-return-label">추천 후 수익</span>
        <span
          className={[
            "yds-spick-hero-card__hero-return-value",
            "font-mono tabular-nums",
            `yds-spick-hero-card__return--${retTone}`,
          ].join(" ")}
        >
          {row.returnLabel}
        </span>
      </div>

      <dl className="yds-spick-hero-card__priority-metrics">
        <div className="yds-spick-hero-card__metric yds-spick-hero-card__metric--price">
          <dt>현재가</dt>
          <dd className="font-mono tabular-nums">{row.currentPriceLabel}</dd>
        </div>
        <div className="yds-spick-hero-card__metric yds-spick-hero-card__metric--price">
          <dt>추천가</dt>
          <dd className="font-mono tabular-nums">{row.recommendedPriceLabel}</dd>
        </div>
        <div className="yds-spick-hero-card__metric">
          <dt>AI점수</dt>
          <dd className="font-mono tabular-nums">{row.aiScore}</dd>
        </div>
        <div className="yds-spick-hero-card__metric">
          <dt>신뢰도</dt>
          <dd>{confLabel}</dd>
        </div>
        <div className="yds-spick-hero-card__metric yds-spick-hero-card__metric--wide">
          <dt>예상보유</dt>
          <dd>{row.holdPeriodLabel}</dd>
        </div>
      </dl>

      <div className="yds-spick-hero-card__footer">
        <YdsStockPickRecommendRationale
          topReasons={trust?.topReasons}
          detailReasons={[]}
          items={stock.recommendRationales ?? []}
          title="추천이유"
          maxItems={2}
          className="yds-spick-hero-card__rationale yds-spick-hero-card__rationale--compact"
        />

        <YdsStockPickActionGuide
          guide={stock.actionGuide}
          className="yds-spick-hero-card__action-guide yds-spick-hero-card__action-guide--compact"
        />

        <Link to={to} className="yds-spick-hero-card__cta">
          AI 상세 분석
        </Link>
      </div>
    </article>
  )
}
