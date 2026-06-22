import { Link } from "react-router-dom"
import YdsDeskCard from "./YdsDeskCard.jsx"

/**
 * @param {{
 *   report: ReturnType<typeof import("../../content/ydsInvestmentCalendarEngine.js").buildUnifiedWeekEventStrip>
 * }} props
 */
export default function YdsDashboardWeekEvents({ report }) {
  if (!report?.hasEvents) return null

  const hasMacro = report.macroItems.length > 0
  const hasStock = report.stockItems.length > 0

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
      <div className="yds-week-events-unified">
        {hasMacro ? (
          <section className="yds-week-events-unified__section" aria-labelledby="desk-week-events-macro">
            <h3 id="desk-week-events-macro" className="yds-week-events-unified__head">
              <span className="yds-week-events-unified__badge yds-week-events-unified__badge--macro">
                거시경제
              </span>
            </h3>
            <ul className="yds-desk-card__list">
              {report.macroItems.map((event) => {
                const dateLabel = event.date.slice(5).replace("-", "/")
                return (
                  <li key={event.id} className="yds-desk-card__item">
                    <span className="yds-desk-card__bullet yds-desk-card__bullet--macro" aria-hidden>
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
          </section>
        ) : null}

        {hasStock ? (
          <section className="yds-week-events-unified__section" aria-labelledby="desk-week-events-stock">
            <h3 id="desk-week-events-stock" className="yds-week-events-unified__head">
              <span className="yds-week-events-unified__badge yds-week-events-unified__badge--stock">
                종목/실적
              </span>
            </h3>
            <ul className="yds-desk-card__list">
              {report.stockItems.map((event) => {
                const dateLabel = event.date.slice(5).replace("-", "/")
                return (
                  <li key={event.id} className="yds-desk-card__item yds-desk-card__item--stock">
                    <span className="yds-desk-card__bullet yds-desk-card__bullet--stock" aria-hidden>
                      ■
                    </span>
                    <div className="yds-desk-card__stock-body">
                      <Link
                        to={`/stock-picks/${encodeURIComponent(event.ticker)}`}
                        className="yds-desk-card__name yds-desk-card__stock-link"
                      >
                        {event.eventTitle}
                      </Link>
                      <span className="yds-desk-card__stock-impact">{event.impactLine}</span>
                    </div>
                    <span className="yds-desk-card__date font-mono tabular-nums">{dateLabel}</span>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </YdsDeskCard>
  )
}
