/**
 * 차트 하단 — 매매 이벤트 마커 스트립
 */

/**
 * @param {{
 *   events: { axisLabel: string; eventLabel: string; reason: string; eventId?: string }[]
 * }} props
 */
export default function PanicChartEventStrip({ events }) {
  if (!events.length) return null

  return (
    <div className="panic-chart-event-strip" aria-label="매매 이벤트 마커">
      {events.map((ev) => (
        <span
          key={`${ev.axisLabel}-${ev.eventLabel}`}
          className={["panic-chart-event-strip__chip", ev.eventId ? `panic-chart-event-strip__chip--${ev.eventId}` : ""].join(
            " ",
          )}
          title={`${ev.axisLabel} ${ev.eventLabel} — ${ev.reason}`}
        >
          <span className="panic-chart-event-strip__dot" aria-hidden>
            ●
          </span>
          <span className="panic-chart-event-strip__label">{ev.eventLabel}</span>
        </span>
      ))}
    </div>
  )
}
