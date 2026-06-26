import { useLayoutEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { formatCalendarMonthDay } from "../../utils/calendarDateUtils.js"
import YdsDeskCard from "./YdsDeskCard.jsx"

export const WEEK_EVENTS_MACRO_PREVIEW = 6
export const WEEK_EVENTS_STOCK_PREVIEW = 5

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
 *   sectionId: string
 *   label: string
 *   badgeClass: string
 *   items: Record<string, unknown>[]
 *   kind: 'macro' | 'stock'
 *   previewCount: number
 *   expanded: boolean
 * }} props
 */
function EventSection({
  sectionId,
  label,
  badgeClass,
  items,
  kind,
  previewCount,
  expanded,
}) {
  if (items.length === 0) return null

  const visibleItems = expanded ? items : items.slice(0, previewCount)

  return (
    <section className="yds-week-events-unified__section" aria-labelledby={sectionId}>
      <h3 id={sectionId} className="yds-week-events-unified__head">
        <span className={["yds-week-events-unified__badge", badgeClass].join(" ")}>
          {label}
        </span>
      </h3>
      <ul className="yds-desk-card__list">
        {visibleItems.map((event) => (
          <WeekEventRow key={event.id} event={{ ...event, kind }} />
        ))}
      </ul>
    </section>
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
  const bodyRef = useRef(null)
  const [maxHeight, setMaxHeight] = useState("none")
  const [animate, setAnimate] = useState(false)

  const hasEvents = Boolean(report?.hasEvents)
  const macroPreview =
    report?.macroPreviewLimit ?? WEEK_EVENTS_MACRO_PREVIEW
  const stockPreview =
    report?.stockPreviewLimit ?? WEEK_EVENTS_STOCK_PREVIEW
  const macroItems = report?.macroItems ?? []
  const stockItems = report?.stockItems ?? []

  const hiddenCount =
    Math.max(0, macroItems.length - macroPreview) +
    Math.max(0, stockItems.length - stockPreview)
  const showMore = hiddenCount > 0

  useLayoutEffect(() => {
    if (!hasEvents) return
    const node = bodyRef.current
    if (!node) return
    setMaxHeight(`${node.scrollHeight}px`)
    if (!animate) {
      const frame = requestAnimationFrame(() => setAnimate(true))
      return () => cancelAnimationFrame(frame)
    }
  }, [expanded, macroItems.length, stockItems.length, animate, hasEvents])

  if (!hasEvents) return null

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
      <div
        ref={bodyRef}
        className={[
          "yds-week-events-unified",
          "yds-week-events-collapsible",
          animate ? "yds-week-events-collapsible--animate" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ maxHeight }}
      >
        <EventSection
          sectionId="desk-week-events-macro"
          label="거시경제"
          badgeClass="yds-week-events-unified__badge--macro"
          items={macroItems}
          kind="macro"
          previewCount={macroPreview}
          expanded={expanded}
        />
        <EventSection
          sectionId="desk-week-events-stock"
          label="종목/실적"
          badgeClass="yds-week-events-unified__badge--stock"
          items={stockItems}
          kind="stock"
          previewCount={stockPreview}
          expanded={expanded}
        />
      </div>

      {showMore ? (
        <button
          type="button"
          className="yds-week-events-unified__more"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? "접기 ▲" : `더보기 (${hiddenCount}건)`}
        </button>
      ) : null}
    </YdsDeskCard>
  )
}
