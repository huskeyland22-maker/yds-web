import { Link } from "react-router-dom"

/**
 * @param {{ event: import("../../content/ydsInvestmentCalendarEngine.js").CalendarEvent }} props
 */
function ImpactBadge({ event }) {
  return (
    <span className={`yds-inv-cal__impact yds-inv-cal__impact--${event.impact}`}>
      {event.impactLabel}
    </span>
  )
}

/**
 * @param {{
 *   event: import("../../content/ydsInvestmentCalendarEngine.js").CalendarEvent
 *   compact?: boolean
 * }} props
 */
export function YdsInvestmentCalendarRow({ event, compact = false }) {
  const isMacro = event.kind === "macro"
  const dateLabel = event.date.slice(5).replace("-", "/")
  const weekday = new Date(`${event.date}T12:00:00`).toLocaleDateString("ko-KR", { weekday: "short" })

  return (
    <article className={`yds-inv-cal__row ${compact ? "yds-inv-cal__row--compact" : ""}`}>
      <div className="yds-inv-cal__date font-mono tabular-nums">
        <span>{dateLabel}</span>
        {!compact ? <span className="yds-inv-cal__weekday">{weekday}</span> : null}
      </div>
      <div className="yds-inv-cal__body">
        <div className="yds-inv-cal__head">
          <span className="yds-inv-cal__cat">{event.categoryLabel}</span>
          <span className="yds-inv-cal__stars" aria-label={`중요도 ${event.importance}단계`}>
            {event.importanceStars}
          </span>
        </div>
        <p className="yds-inv-cal__title">
          {isMacro ? (
            event.title
          ) : (
            <>
              <Link to={`/stock-picks/${encodeURIComponent(event.ticker)}`} className="yds-inv-cal__link">
                {event.name}
              </Link>
              <span className="yds-inv-cal__ticker font-mono">{event.ticker}</span>
            </>
          )}
        </p>
        {!compact && isMacro && event.subtitle ? (
          <p className="yds-inv-cal__sub">{event.subtitle}</p>
        ) : null}
        {!compact ? <p className="yds-inv-cal__note">{event.impactNote}</p> : null}
      </div>
      <ImpactBadge event={event} />
    </article>
  )
}

/**
 * @param {{
 *   report: ReturnType<typeof import("../../content/ydsInvestmentCalendarEngine.js").buildWeekEventStrip>
 *   compact?: boolean
 * }} props
 */
export default function YdsInvestmentCalendarStrip({ report, compact = true }) {
  return (
    <section className="yds-inv-cal yds-inv-cal--strip" aria-labelledby="inv-cal-strip-title">
      <div className="yds-inv-cal__strip-head">
        <div>
          <h2 id="inv-cal-strip-title" className="yds-inv-cal__strip-title">
            이번주 주요 이벤트
          </h2>
          <p className="yds-inv-cal__strip-sub">
            {report.week.label}
            {report.marketStage ? ` · ${report.marketStage}` : ""}
          </p>
        </div>
        <Link to="/investment-calendar" className="yds-inv-cal__more">
          전체 캘린더 →
        </Link>
      </div>

      {!report.hasEvents ? (
        <p className="yds-inv-cal__empty">이번 주 등록된 주요 일정이 없습니다.</p>
      ) : (
        <div className="yds-inv-cal__strip-list">
          {report.stripItems.map((event) => (
            <YdsInvestmentCalendarRow key={event.id} event={event} compact={compact} />
          ))}
        </div>
      )}
    </section>
  )
}
