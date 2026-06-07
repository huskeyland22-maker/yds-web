import { useMemo } from "react"
import { resolveEventLayer } from "../../content/ydsEventLayer.js"

/**
 * Event Layer V1.5 — Hero 내 또는 독립 섹션
 * @param {{ panicData?: object | null; historyRows?: object[]; embedded?: boolean }} props
 */
export default function YdsEventLayerCard({
  panicData = null,
  historyRows = [],
  embedded = false,
}) {
  const view = useMemo(() => resolveEventLayer(panicData, historyRows), [panicData, historyRows])

  if (!view.hasEvents) return null

  return (
    <section
      className={[
        embedded ? "yds-market-hero__event-block" : "yds-event-layer yds-event-layer--desk",
        !embedded && view.level === "exit" ? "yds-event-layer--strong" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="주요 시장 이벤트"
    >
      <h2 className={embedded ? "yds-market-hero__event-title" : "yds-event-layer__title"}>
        📢 주요 시장 이벤트
      </h2>
      {view.events.map((ev) => (
        <article key={ev.id} className={embedded ? "yds-market-hero__event-item" : "yds-event-layer__item"}>
          <p className={embedded ? "yds-market-hero__event-headline" : "yds-event-layer__headline"}>
            {ev.emoji} {ev.title}
          </p>
          {ev.summary ? (
            <p className={embedded ? "yds-market-hero__event-line" : "yds-event-layer__line"}>
              {ev.summary}
            </p>
          ) : null}
        </article>
      ))}
    </section>
  )
}

export { resolveEventLayer }
