import { ACTION_DIMENSION_LABELS } from "../../content/ydsDashboardActionGuide.js"
import YdsDeskCard from "./YdsDeskCard.jsx"

/**
 * @param {{
 *   report: import("../../content/ydsDashboardActionGuide.js").DashboardActionGuideReport
 *   summary?: { headline?: string; signalEmoji?: string; actions?: string[] } | null
 *   className?: string
 * }} props
 */
export default function YdsDashboardActionGuide({ report, summary = null, className = "" }) {
  if (!report?.visible) return null

  const headline = summary?.headline?.trim()
  const actionTags = Array.isArray(summary?.actions)
    ? summary.actions.filter((line) => String(line).trim())
    : []

  return (
    <YdsDeskCard title={report.title} titleId="desk-action-guide-title" className={className}>
      {headline ? (
        <p className="yds-desk-card__summary-headline">
          {summary?.signalEmoji ? (
            <span className="yds-desk-card__summary-signal" aria-hidden>
              {summary.signalEmoji}{" "}
            </span>
          ) : null}
          {headline}
        </p>
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

      {actionTags.length ? (
        <div className="yds-desk-card__action-block">
          <p className="yds-desk-card__action-block-title">추천 행동</p>
          <ul className="yds-desk-card__action-tags">
            {actionTags.map((action) => (
              <li key={action} className="yds-desk-card__action-tag">
                <span className="yds-desk-card__action-tag-mark" aria-hidden>
                  ✓
                </span>
                {action}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.recommendedActions.length ? (
        <div className="yds-desk-card__action-block">
          <p className="yds-desk-card__action-block-title">핵심 행동 체크리스트</p>
          <ul className="yds-desk-card__checklist yds-desk-card__checklist--flush">
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
      ) : null}
    </YdsDeskCard>
  )
}
