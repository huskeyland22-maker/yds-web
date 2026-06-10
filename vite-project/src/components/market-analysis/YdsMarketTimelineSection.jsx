import { useEffect, useMemo, useState } from "react"
import {
  formatTimelineDateLabel,
  formatTimelineStreamLead,
  resolveMarketTimeline,
  timelineEventEmoji,
} from "../../content/ydsMarketTimeline.js"
import {
  clearLegacyEventHistoryStorage,
  fetchSeedEventHistory,
  loadStoredEventHistory,
  mergeSeedAndStored,
  saveStoredEventHistory,
} from "../../content/ydsMarketEventHistoryStorage.js"

const DEFAULT_COLLAPSED = 5

/**
 * V3 시장 변화 기록 — stream(5건+전체보기) · full(details)
 * @param {{
 *   panicData?: object | null
 *   historyRows?: object[]
 *   className?: string
 *   variant?: "stream" | "full"
 *   collapsedVisible?: number
 *   onViewAllHistory?: () => void
 * }} props
 */
export default function YdsMarketTimelineSection({
  panicData = null,
  historyRows = [],
  className = "",
  variant = "full",
  collapsedVisible = DEFAULT_COLLAPSED,
  onViewAllHistory,
}) {
  const [storedEvents, setStoredEvents] = useState(() => loadStoredEventHistory())
  const [seedLoaded, setSeedLoaded] = useState(false)
  const [expanded, setExpanded] = useState(variant === "full")

  useEffect(() => {
    clearLegacyEventHistoryStorage()
  }, [])

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
    saveStoredEventHistory(view.events)
  }, [view.events, seedLoaded, storedEvents.length])

  if (!view.events.length) return null

  const isStream = variant === "stream"
  const visibleCap = isStream ? collapsedVisible : expanded ? view.events.length : collapsedVisible
  const visibleEvents = expanded ? view.events : view.events.slice(0, visibleCap)
  const hiddenCount = Math.max(0, view.events.length - visibleCap)
  const showExpandToggle = !isStream && hiddenCount > 0
  const showHistoryLink = isStream && hiddenCount > 0 && typeof onViewAllHistory === "function"

  return (
    <section
      className={[
        "yds-market-timeline",
        expanded ? "yds-market-timeline--expanded" : "yds-market-timeline--collapsed",
        isStream ? "yds-market-timeline--stream" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="최근 전환 신호"
    >
      <div className="yds-market-timeline__head">
        <h2 className="yds-market-timeline__title">최근 전환 신호</h2>
      </div>

      <ol className="yds-market-timeline__list">
        {visibleEvents.map((ev) => {
          const dateLabel = formatTimelineDateLabel(ev.date)
          const emoji = timelineEventEmoji(ev.type)
          const lead = formatTimelineStreamLead(ev)

          if (!expanded) {
            return (
              <li
                key={`${ev.date}:${ev.type}`}
                className="yds-market-timeline__item yds-market-timeline__item--stream"
              >
                <p className="yds-market-timeline__stream-date font-mono tabular-nums">{dateLabel}</p>
                {lead ? (
                  <p className="yds-market-timeline__stream-metric font-mono tabular-nums">
                    {emoji} {lead}
                  </p>
                ) : null}
                <p className="yds-market-timeline__stream-title">{ev.title}</p>
              </li>
            )
          }

          const metrics = ev.metrics || (ev.description !== ev.title ? ev.description : "")
          const action = ev.action || ""
          return (
            <li key={`${ev.date}:${ev.type}`} className="yds-market-timeline__item">
              <p className="yds-market-timeline__date font-mono tabular-nums">{dateLabel}</p>
              <div className="yds-market-timeline__body">
                {lead ? (
                  <p className="yds-market-timeline__event-metrics font-mono tabular-nums">
                    {emoji} {lead}
                  </p>
                ) : null}
                <p className="yds-market-timeline__event-title">{ev.title}</p>
                {!lead && metrics ? (
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

      {showHistoryLink ? (
        <button
          type="button"
          className="yds-market-timeline__history-link"
          onClick={onViewAllHistory}
        >
          전체 보기
        </button>
      ) : null}

      {showExpandToggle ? (
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
