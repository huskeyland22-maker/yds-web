import { useMemo } from "react"
import { resolveEventLayer } from "../../content/ydsEventLayer.js"

/**
 * Event Layer V1.3 — 최근 시장 변화 (State·Action과 분리)
 * @param {{ panicData?: object | null; historyRows?: object[]; compact?: boolean }} props
 */
export default function YdsEventLayerCard({ panicData = null, historyRows = [], compact = false }) {
  const view = useMemo(() => resolveEventLayer(panicData, historyRows), [panicData, historyRows])

  if (!view.hasEvents) return null

  return (
    <section
      className={[
        "yds-event-layer",
        compact ? "yds-event-layer--compact" : "yds-event-layer--desk",
        view.level === "panicEntry" ? "yds-event-layer--strong" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="주요 시장 이벤트"
    >
      <h2 className="yds-event-layer__title">📢 주요 시장 이벤트</h2>
      {view.events.map((ev) => (
        <article key={ev.id} className="yds-event-layer__item">
          <p className="yds-event-layer__headline">📢 {ev.title}</p>
          <p className="yds-event-layer__line">{ev.summary}</p>
        </article>
      ))}
    </section>
  )
}

export { resolveEventLayer }
