import { Link } from "react-router-dom"
import YdsStockPickFavoriteButton from "./YdsStockPickFavoriteButton.jsx"
import YdsStockPickRecommendRationale from "./YdsStockPickRecommendRationale.jsx"
import YdsStockPickRecommendStatusBadge from "./YdsStockPickRecommendStatusBadge.jsx"
import YdsStockPickActionGuide from "./YdsStockPickActionGuide.jsx"
import YdsRecommendProfitInfoTip from "./YdsRecommendProfitInfoTip.jsx"
import { buildStockPickListRow } from "../../content/ydsStockPickListView.js"

/** @param {string | null | undefined} dateKey */
function formatRecommendDateDot(dateKey) {
  const d = String(dateKey ?? "").slice(0, 10)
  if (d.length < 10) return "—"
  return `${d.slice(0, 4)}.${d.slice(5, 7)}.${d.slice(8, 10)}`
}

/** @param {import("../../content/ydsStockPickModel.js").StockPickView} stock */
function resolveGradeBadge(stock) {
  const grade =
    stock.v4Score?.qualityDisplayGrade ?? stock.v4Score?.qualityGrade ?? null
  if (!grade || grade === "—") return null
  return String(grade).split(/[·\s]/)[0]?.trim() || null
}

/**
 * @param {{ score: number; className?: string }} props
 */
function AiScoreBar({ score, className = "" }) {
  const pct = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0
  const tone =
    score >= 90 ? "very-high" : score >= 80 ? "high" : score >= 70 ? "mid" : "low"
  return (
    <span className={["yds-spick-ai-score", className].filter(Boolean).join(" ")}>
      <span className="font-mono tabular-nums">{Number.isFinite(score) ? score : "—"}</span>
      <span className={`yds-spick-ai-score__bar yds-spick-ai-score__bar--${tone}`}>
        <span className="yds-spick-ai-score__fill" style={{ width: `${pct}%` }} />
      </span>
    </span>
  )
}

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
  const retTone = row.returnTone ?? "muted"
  const elapsedLabel =
    row.daysSinceRecommend != null ? `D+${row.daysSinceRecommend}` : "—"
  const rankNum = rankIndex != null ? rankIndex + 1 : stock.rank
  const isBestPick = rankNum != null && rankNum >= 1 && rankNum <= 3
  const gradeBadge = resolveGradeBadge(stock)

  const rankClass =
    rankIndex === 0
      ? "yds-spick-hero-card--rank-1"
      : rankIndex === 1
        ? "yds-spick-hero-card--rank-2"
        : rankIndex === 2
          ? "yds-spick-hero-card--rank-3"
          : rankIndex != null && rankIndex >= 3
            ? "yds-spick-hero-card--rank-n"
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
      {isBestPick ? (
        <span className="yds-spick-hero-card__best-badge">AI Best Pick</span>
      ) : null}

      <div className="yds-spick-hero-card__head">
        {rankNum != null ? (
          <span className="yds-spick-hero-card__rank-num font-mono tabular-nums">#{rankNum}</span>
        ) : null}
        {medal ? <span className="yds-spick-hero-card__medal">{medal}</span> : null}
        <Link to={to} className="yds-spick-hero-card__name-link">
          <h3 className="yds-spick-hero-card__name">{stock.name}</h3>
        </Link>
        <div className="yds-spick-hero-card__tools">
          {gradeBadge ? (
            <span className="yds-spick-hero-card__grade-badge">{gradeBadge}</span>
          ) : null}
          {isHeld ? <span className="yds-spick-hero-card__held">보유</span> : null}
          <YdsStockPickFavoriteButton
            active={isFavorite}
            onToggle={() => onToggleFavorite(stock.ticker)}
          />
        </div>
      </div>

      <YdsStockPickRecommendStatusBadge stock={stock} compact className="yds-spick-hero-card__status" />

      <dl className="yds-spick-hero-card__grid2 yds-spick-hero-card__perf-grid">
        <div>
          <dt>추천일</dt>
          <dd className="font-mono tabular-nums">{formatRecommendDateDot(row.recommendedAt)}</dd>
        </div>
        <div>
          <dt>현재가</dt>
          <dd className="font-mono tabular-nums">{row.currentPriceLabel}</dd>
        </div>
        <div>
          <dt>추천가</dt>
          <dd className="font-mono tabular-nums">{row.recommendedPriceLabel}</dd>
        </div>
        <div>
          <dt>경과</dt>
          <dd className="font-mono tabular-nums">{elapsedLabel}</dd>
        </div>
      </dl>

      <div className="yds-spick-hero-card__hero-return">
        <div className="yds-spick-hero-card__hero-return-label-row">
          <span className="yds-spick-hero-card__hero-return-label">추천 후 수익</span>
          <YdsRecommendProfitInfoTip />
        </div>
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
        <div className="yds-spick-hero-card__metric">
          <dt>AI점수</dt>
          <dd>
            <AiScoreBar score={row.aiScore} />
          </dd>
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
