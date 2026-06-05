import { Link } from "react-router-dom"
import { UI_PAGE } from "../../utils/ydsUiLabels.js"

/**
 * @param {{
 *   step?: 'hub' | 'watchlist' | 'alert' | 'performance'
 *   stockId?: string | null
 *   stockName?: string | null
 * }} props
 */
export default function RecommendationJourneyStrip({ step = "hub", stockId = null, stockName = null }) {
  const watchHash = stockId ? `#watchlist-${stockId}` : ""

  return (
    <nav className="yds-journey-strip" aria-label="추천 흐름 다음 단계">
      <span className="yds-journey-strip__label">다음 단계</span>
      <div className="yds-journey-strip__links">
        {step !== "hub" ? (
          <Link to="/market-analysis" className="yds-journey-strip__link">
            시장분석
          </Link>
        ) : null}
        {step !== "watchlist" ? (
          <Link
            to={`/stock-picks${watchHash}`}
            className="yds-journey-strip__link yds-journey-strip__link--primary"
          >
            {stockName
              ? `${stockName} · ${UI_PAGE.stockPicks?.title ?? UI_PAGE.watchlist.title}`
              : (UI_PAGE.stockPicks?.title ?? UI_PAGE.watchlist.title)}
          </Link>
        ) : null}
        {step !== "alert" ? (
          <Link to="/alert-center" className="yds-journey-strip__link">
            알림
          </Link>
        ) : null}
        {step !== "performance" ? (
          <Link to="/recommendation-history" className="yds-journey-strip__link">
            추천 기록
          </Link>
        ) : null}
        <Link to="/performance-center" className="yds-journey-strip__link">
          성과
        </Link>
      </div>
    </nav>
  )
}
