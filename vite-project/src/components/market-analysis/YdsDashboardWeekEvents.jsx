import { useState } from "react"
import { Link } from "react-router-dom"
import YdsDeskCard from "./YdsDeskCard.jsx"

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
  const flatItems = report.flatItems ?? []
  const mobileItems = expanded ? flatItems : flatItems.slice(0, previewLimit)
  const showMore = flatItems.length > previewLimit

  const hasMacro = report.macroItems.length > 0
  const hasStock = report.stockItems.length > 0

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
      <div className="yds-week-events-unified yds-week-events-unified--mobile">
        <ul className="yds-desk-card__list">
          {mobileItems.map((event) => {
            const dateLabel = event.date.slice(5).replace("-", "/")
            if (event.kind === "macro") {
              const tier = event.marketTier ?? event.importanceTier
              return (
                <li key={event.id} className="yds-desk-card__item">
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
                  <span className="yds-desk-card__stock-impact">
                    {event.impactStars} {event.impactRelation}
                  </span>
                </div>
                <span className="yds-desk-card__date font-mono tabular-nums">{dateLabel}</span>
              </li>
            )
          })}
        </ul>
        {showMore ? (
          <button
            type="button"
            className="yds-week-events-unified__more"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? "접기" : `더보기 (${flatItems.length - previewLimit}건)`}
          </button>
        ) : null}
      </div>

      <div className="yds-week-events-unified yds-week-events-unified--desktop">
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
                const tier = event.marketTier ?? event.importanceTier
                return (
                  <li key={event.id} className="yds-desk-card__item">
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
                      <span className="yds-desk-card__stock-impact">
                        {event.impactStars} {event.impactRelation}
                      </span>
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
