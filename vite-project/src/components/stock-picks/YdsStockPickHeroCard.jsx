import { Link } from "react-router-dom"
import YdsStockPickFavoriteButton from "./YdsStockPickFavoriteButton.jsx"
import YdsStockPickAiConfidenceBar from "./YdsStockPickAiConfidenceBar.jsx"
import YdsStockPickRecommendRationale from "./YdsStockPickRecommendRationale.jsx"
import YdsStockPickRecommendStatusBadge from "./YdsStockPickRecommendStatusBadge.jsx"
import YdsStockPickActionGuide from "./YdsStockPickActionGuide.jsx"

/**
 * GO #72 — TOP5: WHY · AI 의견 · 행동 · 신뢰도 · 상태 (비교 수치는 전체 종목)
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
  const to = `/stock-picks/${encodeURIComponent(stock.ticker)}`
  const aiOpinion = stock.opinion?.summary || stock.opinion?.headline || stock.recommendReasonSummary

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

      <YdsStockPickRecommendRationale
        topReasons={trust?.topReasons}
        detailReasons={[]}
        items={stock.recommendRationales ?? []}
        title="왜 추천하는가"
        maxItems={3}
        className="yds-spick-hero-card__rationale"
      />

      {aiOpinion ? (
        <p className="yds-spick-hero-card__opinion">{aiOpinion}</p>
      ) : null}

      <YdsStockPickActionGuide
        guide={stock.actionGuide}
        className="yds-spick-hero-card__action-guide"
      />

      <YdsStockPickAiConfidenceBar
        score={trust?.aiConfidence?.score}
        compact
        className="yds-spick-hero-card__conf"
      />

      <Link to={to} className="yds-spick-hero-card__cta">
        AI 상세 분석 보기
      </Link>
    </article>
  )
}
