import { Link } from "react-router-dom"

/**
 * @param {{
 *   report: ReturnType<typeof import("../../content/ydsInvestmentCalendarEngine.js").buildWeekEventStrip>
 * }} props
 */
export default function YdsDashboardWeekEvents({ report }) {
  if (!report?.hasEvents) return null

  return (
    <section
      className="yds-desk-brief yds-desk-brief--events"
      aria-labelledby="desk-week-events-title"
    >
      <div className="yds-desk-brief__head">
        <h2 id="desk-week-events-title" className="yds-desk-brief__title">
          이번주 주요 이벤트
        </h2>
        <Link to="/investment-calendar" className="yds-desk-brief__more">
          캘린더 →
        </Link>
      </div>

      <ul className="yds-desk-brief__list">
        {report.stripItems.map((event) => {
          const dateLabel = event.date.slice(5).replace("-", "/")
          return (
            <li key={event.id} className="yds-desk-brief__item">
              <span className="yds-desk-brief__bullet" aria-hidden>
                ■
              </span>
              <span className="yds-desk-brief__name">{event.briefLabel}</span>
              <span className="yds-desk-brief__date font-mono tabular-nums">{dateLabel}</span>
              <span
                className={`yds-desk-brief__tier yds-desk-brief__tier--${event.importance}`}
                aria-label={`중요도 ${event.importanceTier}`}
              >
                {event.importanceTier}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
