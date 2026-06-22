import YdsDeskCard from "./YdsDeskCard.jsx"

/**
 * @param {{ report: import("../../content/ydsDashboardActionGuide.js").DashboardActionGuideReport }} props
 */
export default function YdsDashboardActionGuide({ report }) {
  if (!report?.visible) return null

  return (
    <YdsDeskCard title={report.title} titleId="desk-action-guide-title">
      <dl className="yds-desk-card__panel yds-desk-card__action-stars">
        <div className="yds-desk-card__action-star">
          <dt>매수</dt>
          <dd className="yds-desk-card__stars" aria-label={`매수 ${report.stars.buy}점`}>
            {report.buyStars}
          </dd>
        </div>
        <div className="yds-desk-card__action-star">
          <dt>관망</dt>
          <dd className="yds-desk-card__stars" aria-label={`관망 ${report.stars.watch}점`}>
            {report.watchStars}
          </dd>
        </div>
        <div className="yds-desk-card__action-star">
          <dt>현금</dt>
          <dd className="yds-desk-card__stars" aria-label={`현금 ${report.stars.cash}점`}>
            {report.cashStars}
          </dd>
        </div>
      </dl>

      <div className="yds-desk-card__guide">
        <h3 className="yds-desk-card__guide-label">추천 행동</h3>
        <ul className="yds-desk-card__checklist">
          {report.recommendedActions.map((line) => (
            <li key={line} className="yds-desk-card__check">
              <span className="yds-desk-card__check-mark" aria-hidden>
                ✓
              </span>
              {line}
            </li>
          ))}
        </ul>
      </div>
    </YdsDeskCard>
  )
}
