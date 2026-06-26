import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { buildStockPickDeskPreview } from "../../content/ydsStockPickDeskPreview.js"
import YdsStockPickRecommendRationale from "../stock-picks/YdsStockPickRecommendRationale.jsx"
import YdsStockPickDetailPanel from "../stock-picks/YdsStockPickDetailPanel.jsx"

/**
 * @param {{
 *   stock: import("../../content/ydsStockPickModel.js").StockPickView
 * }} props
 */
export default function YdsMarketRecommendCard({ stock }) {
  const [expanded, setExpanded] = useState(false)
  const preview = useMemo(() => buildStockPickDeskPreview(stock), [stock])
  const to = `/stock-picks/${encodeURIComponent(stock.ticker)}`
  const retTone =
    preview.returnSinceRecommend != null && preview.returnSinceRecommend >= 0 ? "up" : "down"

  return (
    <article
      className={[
        "yds-market-rec-card",
        expanded ? "yds-market-rec-card--expanded" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        className="yds-market-rec-card__toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
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

        <YdsStockPickRecommendRationale
          items={stock.recommendRationales ?? []}
          maxItems={3}
          title="왜 추천하는가?"
          className="yds-market-rec-card__rationale"
        />

        <span className="yds-market-rec-card__expand-hint">
          {expanded ? "▲ 상세 접기" : "▼ AI 상세 분석"}
        </span>
      </button>

      {expanded ? (
        <YdsStockPickDetailPanel stock={stock} className="yds-market-rec-card__detail" />
      ) : null}

      <Link to={to} className="yds-market-rec-card__page-link">
        종목 페이지
      </Link>
    </article>
  )
}
