import { Link } from "react-router-dom"
import YdsDeskCard from "./YdsDeskCard.jsx"

/**
 * @param {{ event: import("../../content/ydsInvestmentCalendarEngine.js").PrioritizedStockEvent }} props
 */
export function YdsPrioritizedStockEventRow({ event }) {
  const dateLabel = event.date.slice(5).replace("-", "/")

  return (
    <li className="yds-stock-week-event">
      <span className="yds-stock-week-event__date font-mono tabular-nums">{dateLabel}</span>
      <div className="yds-stock-week-event__body">
        <p className="yds-stock-week-event__title">
          <Link to={`/stock-picks/${encodeURIComponent(event.ticker)}`} className="yds-stock-week-event__link">
            {event.eventTitle}
          </Link>
        </p>
        <p className="yds-stock-week-event__impact">{event.impactLine}</p>
      </div>
    </li>
  )
}

/**
 * @param {{
 *   report: ReturnType<typeof import("../../content/ydsInvestmentCalendarEngine.js").buildStockWeekEventStrip>
 * }} props
 */
export default function YdsDashboardStockWeekEvents({ report }) {
  if (!report?.hasEvents) return null

  return (
    <YdsDeskCard
      title="이번주 종목 이벤트"
      titleId="desk-stock-week-events-title"
      headerExtra={
        <Link to="/investment-calendar" className="yds-desk-card__more">
          캘린더 →
        </Link>
      }
    >
      <ul className="yds-stock-week-event-list">
        {report.stockItems.map((event) => (
          <YdsPrioritizedStockEventRow key={event.id} event={event} />
        ))}
      </ul>
    </YdsDeskCard>
  )
}
