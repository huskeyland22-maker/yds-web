import { Link } from "react-router-dom"
import { formatCalendarMonthDay } from "../../utils/calendarDateUtils.js"

/**
 * @param {{ event: import("../../content/ydsInvestmentCalendarEngine.js").PrioritizedStockEvent }} props
 */
export function YdsPrioritizedStockEventRow({ event }) {
  const dateLabel = formatCalendarMonthDay(event.date)

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
