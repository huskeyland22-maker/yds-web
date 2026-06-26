import { useState } from "react"
import { Link } from "react-router-dom"
import { formatCalendarMonthDay } from "../../utils/calendarDateUtils.js"
import YdsDeskCard from "./YdsDeskCard.jsx"

/**
 * @param {{ event: Record<string, unknown> }} props
 */
function WeekEventRow({ event }) {
  const dateLabel = formatCalendarMonthDay(event.date)

  if (event.kind === "macro") {
    const tier = event.marketTier ?? event.importanceTier
    return (
      <li className="yds-desk-card__item">
        <span className="yds-desk-card__bullet yds-desk-card__bullet--macro" aria-hidden>
          ■
        </span>
        <span className="yds-desk-card__name">{event.briefLabel}</span>
        <span className="yds-desk-card__date font-mono tabular-nums">{dateLabel}</span>
        {tier === "S" ? (
          <span className="yds-desk-card__tier yds-desk-card__tier--s">S</span>
        ) : tier === "A" ? (
          <span className="yds-desk-card__tier yds-desk-card__tier--a">A</span>
        ) : null}
        {event.impactLabel ? (
          <span
            className={[
              "yds-desk-card__impact",
              event.impact === "positive"
                ? "yds-desk-card__impact--positive"
                : event.impact === "negative"
                  ? "yds-desk-card__impact--negative"
                  : "yds-desk-card__impact--neutral",
            ].join(" ")}
          >
            {event.impactLabel}
          </span>
        ) : null}
      </li>
    )
  }

  return (
    <li className="yds-desk-card__item yds-desk-card__item--stock">
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
        <span className="yds-desk-card__stock-impact">
          {event.impactStars} {event.impactRelation}
        </span>
      </div>
      <span className="yds-desk-card__date font-mono tabular-nums">{dateLabel}</span>
    </li>
  )
}

/**
 * @param {{
 *   report: ReturnType<typeof import("../../content/ydsInvestmentCalendarEngine.js").buildUnifiedWeekEventStrip>
 *   className?: string
 * }} props
 */
export default function YdsDashboardWeekEvents({ report, className = "" }) {
  const [expanded, setExpanded] = useState(false)

  if (!report?.hasEvents) return null

  const previewLimit = report.previewLimit ?? 3
  const timelineBuckets = report.timelineBuckets ?? []
  const flatCount = report.flatItems?.length ?? 0
  const showMore = flatCount > previewLimit

  const visibleBuckets = expanded
    ? timelineBuckets
    : (() => {
        let remaining = previewLimit
        /** @type {typeof timelineBuckets} */
        const trimmed = []
        for (const bucket of timelineBuckets) {
          if (remaining <= 0) break
          const items = bucket.items.slice(0, remaining)
          if (items.length === 0) continue
          trimmed.push({ ...bucket, items })
          remaining -= items.length
        }
        return trimmed
      })()

  return (
    <YdsDeskCard
      title="이번주 주요 이벤트"
      titleId="desk-week-events-title"
      className={["yds-week-events-card", className].filter(Boolean).join(" ")}
      headerExtra={
        <Link to="/investment-calendar" className="yds-desk-card__more">
          캘린더 →
        </Link>
      }
    >
      <div className="yds-week-events-timeline">
        {visibleBuckets.map((bucket) => (
          <section
            key={bucket.id}
            className="yds-week-events-timeline__bucket"
            aria-label={bucket.label}
          >
            <h3 className="yds-week-events-timeline__label">
              <span className="yds-week-events-timeline__dot" aria-hidden />
              {bucket.label}
            </h3>
            <ul className="yds-desk-card__list yds-week-events-timeline__list">
              {bucket.items.map((event) => (
                <WeekEventRow key={event.id} event={event} />
              ))}
            </ul>
          </section>
        ))}
      </div>

      {showMore ? (
        <button
          type="button"
          className="yds-week-events-unified__more"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? "접기" : `더보기 (${flatCount - previewLimit}건)`}
        </button>
      ) : null}
    </YdsDeskCard>
  )
}
