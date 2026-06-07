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

/**
 * V1.6 Market Timeline — 최근 5~10개 주요 변화
 * @param {{ panicData?: object | null; historyRows?: object[]; limit?: number }} props
 */
export default function YdsMarketTimelineSection({
  panicData = null,
  historyRows = [],
  limit = 8,
}) {
  const [storedEvents, setStoredEvents] = useState(() => loadStoredEventHistory())
  const [seedLoaded, setSeedLoaded] = useState(false)

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
      limit,
      stored: storedEvents,
    })
  }, [historyRows, panicData, limit, storedEvents])

  useEffect(() => {
    if (!seedLoaded && storedEvents.length === 0) return
    if (view.events.length === 0) return
    saveStoredEventHistory(view.events)
  }, [view.events, seedLoaded, storedEvents.length])

  if (!view.displayEvents.length) return null

  return (
    <section className="yds-market-timeline" aria-label="최근 주요 변화">
      <div className="yds-market-timeline__head">
        <h2 className="yds-market-timeline__title">최근 주요 변화</h2>
        <p className="yds-market-timeline__meta font-mono tabular-nums">
          {view.displayEvents.length} / {view.totalCount}
        </p>
      </div>

      <ol className="yds-market-timeline__list">
        {view.displayEvents.map((ev) => (
          <li key={`${ev.date}:${ev.type}`} className="yds-market-timeline__item">
            <p className="yds-market-timeline__date font-mono tabular-nums">
              {formatTimelineDateLabel(ev.date)}
            </p>
            <div className="yds-market-timeline__body">
              <p className="yds-market-timeline__event-title">
                {timelineEventEmoji(ev.type)} {ev.title}
              </p>
              {ev.description && ev.description !== ev.title ? (
                <p className="yds-market-timeline__event-desc">{ev.description}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
