/**
 * 3계층 Layer Stack — YDS Score → Momentum → Event (표시 전용)
 * @param {{
 *   ydsScore?: number | null
 *   momentumLevel?: string
 *   eventLevel?: string
 * }} props
 */
export default function YdsLayerStackIndicator({
  ydsScore = null,
  momentumLevel = "none",
  eventLevel = "none",
}) {
  const momentumActive = momentumLevel !== "none"
  const eventActive = eventLevel !== "none"

  return (
    <div className="yds-layer-stack" aria-label="YDS 3계층 분석 스택">
      <div className="yds-layer-stack__row yds-layer-stack__row--base">
        <span className="yds-layer-stack__tier">① YDS Score</span>
        <span className="yds-layer-stack__state font-mono tabular-nums">
          {ydsScore != null ? `${ydsScore} · 장기` : "—"}
        </span>
      </div>
      <div
        className={[
          "yds-layer-stack__row",
          momentumActive ? "yds-layer-stack__row--active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span className="yds-layer-stack__tier">② Momentum</span>
        <span className="yds-layer-stack__state">
          {momentumActive ? "⚠️ 단기 변화" : "🟢 안정"}
        </span>
      </div>
      <div
        className={[
          "yds-layer-stack__row",
          eventActive ? "yds-layer-stack__row--event" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span className="yds-layer-stack__tier">③ Event</span>
        <span className="yds-layer-stack__state">
          {eventActive ? "📢 구간 이탈" : "—"}
        </span>
      </div>
    </div>
  )
}
