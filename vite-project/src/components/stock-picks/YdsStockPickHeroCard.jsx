import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  buildStockPickTransparency,
  formatTransparencyPrice,
} from "../../content/ydsStockPickTransparency.js"
import { buildStockPickListRow } from "../../content/ydsStockPickListView.js"
import YdsStockPickFavoriteButton from "./YdsStockPickFavoriteButton.jsx"
import YdsStockPickAiConfidenceBar from "./YdsStockPickAiConfidenceBar.jsx"
import YdsStockPickRecommendRationale from "./YdsStockPickRecommendRationale.jsx"
import YdsStockPickScoreBreakdown from "./YdsStockPickScoreBreakdown.jsx"
import YdsStockPickDetailPanel from "./YdsStockPickDetailPanel.jsx"

/**
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
  const [detailOpen, setDetailOpen] = useState(false)
  const row = useMemo(() => buildStockPickListRow(stock), [stock])
  const transparency = useMemo(() => buildStockPickTransparency(stock), [stock])
  const trust = stock.trustReport
  const v4 = stock.v4Score
  const to = `/stock-picks/${encodeURIComponent(stock.ticker)}`
  const country = stock.country === "KR" ? "KR" : "US"

  const rankClass =
    rankIndex === 0
      ? "yds-spick-hero-card--rank-1"
      : rankIndex === 1
        ? "yds-spick-hero-card--rank-2"
        : rankIndex === 2
          ? "yds-spick-hero-card--rank-3"
          : ""

  const position52w = stock.statusDiag?.inputs?.position52w
  const positionLabel =
    position52w != null && Number.isFinite(position52w)
      ? `52주 ${Math.round(position52w)}%`
      : "—"

  const returnTone =
    row.returnPct == null
      ? "muted"
      : row.returnPct >= 0
        ? "up"
        : "down"

  return (
    <article
      className={[
        "yds-spick-hero-card",
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

      <p className="yds-spick-hero-card__grade font-mono tabular-nums">{row.recommendGrade}</p>

      <div className="yds-spick-hero-card__status-row">
        <span className={`yds-spick-hero-card__status yds-spick-hero-card__status--${row.statusTone}`}>
          {row.statusLabel}
        </span>
      </div>

      <p className="yds-spick-hero-card__price-line font-mono tabular-nums">
        {row.recommendedPriceLabel !== "—" ? (
          <>
            <span className="yds-spick-hero-card__rec">{row.recommendedPriceLabel}</span>
            <span className="yds-spick-hero-card__arrow"> → </span>
          </>
        ) : null}
        <span>{row.currentPriceLabel}</span>
      </p>

      <p className={`yds-spick-hero-card__return font-mono tabular-nums yds-spick-hero-card__return--${returnTone}`}>
        {row.returnLabel}
      </p>

      <dl className="yds-spick-hero-card__metrics">
        <div>
          <dt>AI</dt>
          <dd className="font-mono tabular-nums">{row.aiScore}</dd>
        </div>
        <div>
          <dt>품질</dt>
          <dd className="font-mono tabular-nums">{v4?.qualityDisplayGrade ?? v4?.qualityGrade ?? "—"}</dd>
        </div>
        <div>
          <dt>타이밍</dt>
          <dd className="font-mono tabular-nums">{v4?.timingGrade ?? "—"}</dd>
        </div>
      </dl>

      <YdsStockPickAiConfidenceBar
        score={trust?.aiConfidence?.score}
        compact
        className="yds-spick-hero-card__conf"
      />

      {stock.actionGuide?.summary ? (
        <p className="yds-spick-hero-card__action">{stock.actionGuide.summary}</p>
      ) : null}

      <details className="yds-spick-hero-card__accordion">
        <summary className="yds-spick-hero-card__accordion-summary">세부 지표</summary>
        <div className="yds-spick-hero-card__accordion-body">
          <YdsStockPickRecommendRationale
            topReasons={trust?.topReasons}
            detailReasons={trust?.detailReasons}
            items={stock.recommendRationales ?? []}
            title="핵심 이유"
            className="yds-spick-hero-card__rationale"
          />
          <YdsStockPickScoreBreakdown stock={stock} className="yds-spick-hero-card__scores" />
          <dl className="yds-spick-hero-card__tech">
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
              <dt>52주</dt>
              <dd className="font-mono tabular-nums">{positionLabel}</dd>
            </div>
          </dl>
          <button
            type="button"
            className="yds-spick-hero-card__detail-toggle"
            aria-expanded={detailOpen}
            onClick={() => setDetailOpen((v) => !v)}
          >
            {detailOpen ? "AI 분석 접기" : "AI 분석 펼치기"}
          </button>
          {detailOpen ? (
            <YdsStockPickDetailPanel stock={stock} className="yds-spick-hero-card__detail" />
          ) : null}
        </div>
      </details>
    </article>
  )
}
