/**
 * @param {{ report: import("../../content/ydsDashboardActionGuide.js").DashboardActionGuideReport }} props
 */
export default function YdsDashboardActionGuide({ report }) {
  if (!report?.visible) return null

  return (
    <section
      className="yds-desk-brief yds-desk-brief--action"
      aria-labelledby="desk-action-guide-title"
    >
      <p className="yds-desk-brief__kicker">Institutional Note · Action</p>
      <h2 id="desk-action-guide-title" className="yds-desk-brief__title">
        {report.title}
      </h2>

      <dl className="yds-desk-brief__action-stars">
        <div className="yds-desk-brief__action-star">
          <dt>매수</dt>
          <dd className="yds-desk-brief__stars" aria-label={`매수 ${report.stars.buy}점`}>
            {report.buyStars}
          </dd>
        </div>
        <div className="yds-desk-brief__action-star">
          <dt>관망</dt>
          <dd className="yds-desk-brief__stars" aria-label={`관망 ${report.stars.watch}점`}>
            {report.watchStars}
          </dd>
        </div>
        <div className="yds-desk-brief__action-star">
          <dt>현금</dt>
          <dd className="yds-desk-brief__stars" aria-label={`현금 ${report.stars.cash}점`}>
            {report.cashStars}
          </dd>
        </div>
      </dl>

      <div className="yds-desk-brief__guide">
        <h3 className="yds-desk-brief__guide-label">추천 행동</h3>
        <ul className="yds-desk-brief__checklist">
          {report.recommendedActions.map((line) => (
            <li key={line} className="yds-desk-brief__check">
              <span className="yds-desk-brief__check-mark" aria-hidden>
                ✓
              </span>
              {line}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
