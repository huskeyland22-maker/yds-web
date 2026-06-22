import { Link } from "react-router-dom"
import YdsDeskCard from "./YdsDeskCard.jsx"

/**
 * @param {{
 *   report: ReturnType<typeof import("../../content/ydsInvestmentCalendarEngine.js").buildWeekEventStrip>
 * }} props
 */
export default function YdsDashboardWeekEvents({ report }) {
  if (!report?.hasEvents) return null

  return (
    <YdsDeskCard
      title="이번주 주요 이벤트"
      titleId="desk-week-events-title"
      headerExtra={
        <Link to="/investment-calendar" className="yds-desk-card__more">
          캘린더 →
        </Link>
      }
    >
      <ul className="yds-desk-card__list">
        {report.stripItems.map((event) => {
          const dateLabel = event.date.slice(5).replace("-", "/")
          return (
            <li key={event.id} className="yds-desk-card__item">
              <span className="yds-desk-card__bullet" aria-hidden>
                ■
              </span>
              <span className="yds-desk-card__name">{event.briefLabel}</span>
              <span className="yds-desk-card__date font-mono tabular-nums">{dateLabel}</span>
              <span
                className={`yds-desk-card__tier yds-desk-card__tier--${event.importance}`}
                aria-label={`중요도 ${event.importanceTier}`}
              >
                {event.importanceTier}
              </span>
            </li>
          )
        })}
      </ul>
    </YdsDeskCard>
  )
}
