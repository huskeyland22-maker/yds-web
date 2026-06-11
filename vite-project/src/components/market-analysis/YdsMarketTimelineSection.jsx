import { useEffect, useMemo, useState } from "react"
import {
  formatTimelineDateLabel,
  rebuildMarketTimelineFromHistory,
  validateMarketTimelineAgainstHistory,
} from "../../content/ydsMarketTimeline.js"
import { enrichTimelineEventsWithScoreDeltas } from "../../content/ydsTimelineScoreDelta.js"
import {
  clearLegacyEventHistoryStorage,
  clearStoredEventHistory,
  computePanicHistoryFingerprint,
} from "../../content/ydsMarketEventHistoryStorage.js"

const DEFAULT_COLLAPSED = 3

/**
 * V3 시장 변화 기록 — 패닉 히스토리 전체 재스캔 (localStorage 누적 없음)
 * @param {{
 *   panicData?: object | null
 *   historyRows?: object[]
 *   className?: string
 *   variant?: "stream" | "full"
 *   collapsedVisible?: number
 * }} props
 */
export default function YdsMarketTimelineSection({
  panicData = null,
  historyRows = [],
  className = "",
  variant = "full",
  collapsedVisible = DEFAULT_COLLAPSED,
}) {
  const [expanded, setExpanded] = useState(variant === "full")
  const [streamExpanded, setStreamExpanded] = useState(false)

  const historyFingerprint = useMemo(
    () => computePanicHistoryFingerprint(historyRows, panicData),
    [historyRows, panicData],
  )

  useEffect(() => {
    clearLegacyEventHistoryStorage()
    clearStoredEventHistory()
  }, [])

  useEffect(() => {
    clearStoredEventHistory()
  }, [historyFingerprint])

  const view = useMemo(() => {
    const rebuilt = rebuildMarketTimelineFromHistory(historyRows, panicData, { limit: 50 })
    const validation = validateMarketTimelineAgainstHistory(
      rebuilt.events,
      historyRows,
      panicData,
    )
    if (!validation.ok && typeof console !== "undefined") {
      console.warn("[YDS] 최근 전환 신호 날짜 불일치", validation)
    }
    const events = enrichTimelineEventsWithScoreDeltas(historyRows, rebuilt.events)
    return { ...rebuilt, events, validation }
  }, [historyRows, panicData])

  if (!view.events.length) return null

  const isStream = variant === "stream"
  const isExpanded = isStream ? streamExpanded : expanded
  const visibleCap = isExpanded ? view.events.length : collapsedVisible
  const visibleEvents = view.events.slice(0, visibleCap)
  const hiddenCount = Math.max(0, view.events.length - visibleCap)
  const showExpandToggle = !isStream && hiddenCount > 0
  const showStreamToggle = isStream && view.events.length > collapsedVisible

  return (
    <section
      className={[
        "yds-market-timeline",
        isExpanded ? "yds-market-timeline--expanded" : "yds-market-timeline--collapsed",
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
          const action = ev.action || ""
          const scoreDelta = ev.scoreDelta?.text

          if (isStream) {
            return (
              <li
                key={`${ev.date}:${ev.type}`}
                className="yds-market-timeline__item yds-market-timeline__item--stream yds-market-timeline__item--compact"
              >
                <div className="yds-market-timeline__stream-block">
                  <p className="yds-market-timeline__compact-line yds-market-timeline__compact-line--stream">
                    <span className="yds-market-timeline__compact-date font-mono tabular-nums">
                      {dateLabel}
                    </span>
                    <span className="yds-market-timeline__compact-summary">{ev.title}</span>
                  </p>
                  {scoreDelta ? (
                    <p className="yds-market-timeline__score-delta font-mono tabular-nums">
                      {scoreDelta}
                    </p>
                  ) : null}
                  {action ? (
                    <p className="yds-market-timeline__compact-action yds-market-timeline__compact-action--sub">
                      {action}
                    </p>
                  ) : null}
                </div>
              </li>
            )
          }

          return (
            <li key={`${ev.date}:${ev.type}`} className="yds-market-timeline__item">
              <p className="yds-market-timeline__date font-mono tabular-nums">{dateLabel}</p>
              <div className="yds-market-timeline__body">
                <p className="yds-market-timeline__event-title">{ev.title}</p>
                {scoreDelta ? (
                  <p className="yds-market-timeline__score-delta font-mono tabular-nums">
                    {scoreDelta}
                  </p>
                ) : null}
                {action ? <p className="yds-market-timeline__event-action">{action}</p> : null}
              </div>
            </li>
          )
        })}
      </ol>

      {showStreamToggle ? (
        <button
          type="button"
          className="yds-market-timeline__history-link"
          aria-expanded={streamExpanded}
          onClick={() => setStreamExpanded((open) => !open)}
        >
          {streamExpanded ? "접기" : "최근 기록 더 보기"}
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
