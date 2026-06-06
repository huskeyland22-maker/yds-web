import { useMemo } from "react"
import { resolveEventLayer } from "../../content/ydsEventLayer.js"

/**
 * Event Layer — 구간 이탈 이벤트 (Momentum·YDS와 분리)
 * @param {{ panicData?: object | null; historyRows?: object[]; compact?: boolean }} props
 */
export default function YdsEventLayerCard({ panicData = null, historyRows = [], compact = false }) {
  const view = useMemo(() => resolveEventLayer(panicData, historyRows), [panicData, historyRows])

  if (!view.hasEvents) return null

  return (
    <section
      className={[
        "yds-event-layer",
        compact ? "yds-event-layer--compact" : "",
        view.level === "strongExit" ? "yds-event-layer--strong" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="주요 이벤트 Event Layer"
    >
      <p className="yds-event-layer__title">📢 주요 이벤트</p>
      {view.events.map((ev) => (
        <article key={ev.id} className="yds-event-layer__item">
          <p className="yds-event-layer__headline">{ev.headline}</p>
          <div className="yds-event-layer__explain">
            {ev.explainLines.map((line) => (
              <p key={line} className="yds-event-layer__line">
                {line}
              </p>
            ))}
          </div>
        </article>
      ))}
    </section>
  )
}

export { resolveEventLayer }
