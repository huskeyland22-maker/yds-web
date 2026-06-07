import { useMemo } from "react"
import { resolvePanicDistance } from "../../content/ydsPanicDistance.js"

/**
 * 패닉 거리 — 범례 없이 현재 구간 + 다음 기회 거리만
 */
export default function YdsPanicDistanceCard({
  score = null,
  panicLabel = null,
  panicEmoji = null,
  compact = true,
}) {
  const view = useMemo(() => resolvePanicDistance(score), [score])
  if (!view) return null

  const currentLabel =
    panicLabel && panicEmoji ? `${panicEmoji} 현재 ${panicLabel} ${view.score}` : null

  return (
    <article
      className={["yds-panic-distance", compact ? "yds-panic-distance--compact" : ""]
        .filter(Boolean)
        .join(" ")}
      aria-label="패닉 거리"
    >
      {!compact ? (
        <>
          <p className="yds-panic-distance__tag">Panic Distance · 다음 기회까지</p>
          <h2 className="yds-panic-distance__title">패닉 거리</h2>
        </>
      ) : null}
      <p className="yds-panic-distance__score font-mono tabular-nums">
        {currentLabel ?? `현재 패닉 강도 ${view.score}`}
      </p>
      <ul className="yds-panic-distance__list">
        {view.lines.map((line) => (
          <li
            key={line.id}
            className={[
              "yds-panic-distance__item",
              line.entered ? "yds-panic-distance__item--entered" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {line.emoji} {line.text}
          </li>
        ))}
      </ul>
    </article>
  )
}
