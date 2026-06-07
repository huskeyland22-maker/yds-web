import { useEffect, useMemo, useState } from "react"
import {
  formatTimelineDateLabel,
  resolveMarketTimeline,
  timelineEventEmoji,
} from "../../content/ydsMarketTimeline.js"
import {
  fetchSeedEventHistory,
  loadStoredEventHistory,
  mergeSeedAndStored,
  saveStoredEventHistory,
} from "../../content/ydsMarketEventHistoryStorage.js"

const COLLAPSED_VISIBLE = 2

/**
 * V1.8 시장 전환점 — 기본 2건 · 더보기/접기
 * @param {{ panicData?: object | null; historyRows?: object[] }} props
 */
export default function YdsMarketTimelineSection({
  panicData = null,
  historyRows = [],
}) {
  const [storedEvents, setStoredEvents] = useState(() => loadStoredEventHistory())
  const [seedLoaded, setSeedLoaded] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchSeedEventHistory().then((seed) => {
      if (cancelled) return
      setStoredEvents((prev) => mergeSeedAndStored(prev, seed))
      setSeedLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const view = useMemo(() => {
    return resolveMarketTimeline(historyRows, panicData, {
      limit: 50,
      stored: storedEvents,
    })
  }, [historyRows, panicData, storedEvents])

  useEffect(() => {
    if (!seedLoaded && storedEvents.length === 0) return
    if (view.events.length === 0) return
    saveStoredEventHistory(view.events)
  }, [view.events, seedLoaded, storedEvents.length])

  if (!view.events.length) return null

  const hiddenCount = Math.max(0, view.events.length - COLLAPSED_VISIBLE)
  const visibleEvents = expanded ? view.events : view.events.slice(0, COLLAPSED_VISIBLE)
  const showToggle = hiddenCount > 0

  return (
    <section
      className={[
        "yds-market-timeline",
        expanded ? "yds-market-timeline--expanded" : "yds-market-timeline--collapsed",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="시장 전환점"
    >
      <div className="yds-market-timeline__head">
        <h2 className="yds-market-timeline__title">📍 시장 전환점</h2>
      </div>

      <ol className="yds-market-timeline__list">
        {visibleEvents.map((ev) => {
          const dateLabel = formatTimelineDateLabel(ev.date)
          const emoji = timelineEventEmoji(ev.type)

          if (!expanded) {
            return (
              <li
                key={`${ev.date}:${ev.type}`}
                className="yds-market-timeline__item yds-market-timeline__item--compact"
              >
                <p className="yds-market-timeline__compact-line">
                  <span className="yds-market-timeline__compact-date font-mono tabular-nums">
                    {dateLabel}
                  </span>{" "}
                  {emoji} {ev.title}
                </p>
              </li>
            )
          }

          const metrics = ev.metrics || (ev.description !== ev.title ? ev.description : "")
          const action = ev.action || ""
          return (
            <li key={`${ev.date}:${ev.type}`} className="yds-market-timeline__item">
              <p className="yds-market-timeline__date font-mono tabular-nums">{dateLabel}</p>
              <div className="yds-market-timeline__body">
                <p className="yds-market-timeline__event-title">
                  {emoji} {ev.title}
                </p>
                {metrics ? (
                  <p className="yds-market-timeline__event-metrics font-mono tabular-nums">
                    {metrics}
                  </p>
                ) : null}
                {action ? <p className="yds-market-timeline__event-action">{action}</p> : null}
              </div>
            </li>
          )
        })}
      </ol>

      {showToggle ? (
        <button
          type="button"
          className="yds-market-timeline__toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? "접기" : `+${hiddenCount}개 더보기`}
        </button>
      ) : null}
    </section>
  )
}
