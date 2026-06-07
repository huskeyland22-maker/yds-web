import { useMemo } from "react"
import { YDS_LABEL_PANIC_SCORE } from "../../content/ydsLanguage.js"
import { resolvePanicDistance } from "../../content/ydsPanicDistance.js"

/**
 * V1.9 Panic Distance — Hero 한줄 요약 아래 · 오늘의 행동 위
 * @param {{ score?: number | null }} props
 */
export default function YdsPanicDistanceCard({ score = null }) {
  const view = useMemo(() => resolvePanicDistance(score), [score])
  if (!view) return null

  return (
    <article className="yds-panic-distance" aria-label="패닉 거리">
      <p className="yds-panic-distance__tag">Panic Distance · 다음 기회까지</p>
      <h2 className="yds-panic-distance__title">패닉 거리</h2>
      <p className="yds-panic-distance__score font-mono tabular-nums">
        현재 {YDS_LABEL_PANIC_SCORE} {view.score}
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
