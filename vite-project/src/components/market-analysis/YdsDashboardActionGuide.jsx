import { ACTION_DIMENSION_LABELS } from "../../content/ydsDashboardActionGuide.js"
import YdsDeskCard from "./YdsDeskCard.jsx"

/**
 * @param {{ report: import("../../content/ydsDashboardActionGuide.js").DashboardActionGuideReport; className?: string }} props
 */
export default function YdsDashboardActionGuide({ report, className = "" }) {
  if (!report?.visible) return null

  return (
    <YdsDeskCard title={report.title} titleId="desk-action-guide-title" className={className}>
      {report.liquidityLead ? (
        <p className="yds-desk-card__liquidity-lead">{report.liquidityLead}</p>
      ) : null}

      <dl className="yds-desk-card__panel yds-desk-card__action-stars">
        {ACTION_DIMENSION_LABELS.map(({ key, label, hint }) => (
          <div key={key} className="yds-desk-card__action-star">
            <dt>
              {label}
              <span className="yds-desk-card__action-hint">{hint}</span>
            </dt>
            <dd
              className="yds-desk-card__stars"
              aria-label={`${label} ${report.stars[key]}점`}
            >
              {key === "buy"
                ? report.buyStars
                : key === "watch"
                  ? report.watchStars
                  : report.cashStars}
            </dd>
          </div>
        ))}
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
