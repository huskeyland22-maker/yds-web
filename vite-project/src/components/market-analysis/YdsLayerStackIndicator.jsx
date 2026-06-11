/**
 * 4계층 Layer Stack — Level → Momentum → Regime → Event (표시 전용)
 * @param {{
 *   levelLabel?: string | null
 *   regimeLabel?: string | null
 *   ydsScore?: number | null
 *   momentumLevel?: string
 *   eventLevel?: string
 *   compact?: boolean
 * }} props
 */
export default function YdsLayerStackIndicator({
  levelLabel = null,
  regimeLabel = null,
  ydsScore = null,
  momentumLevel = "none",
  eventLevel = "none",
  compact = false,
}) {
  const momentumActive = momentumLevel !== "none"
  const eventActive = eventLevel !== "none"

  return (
    <div
      className={["yds-layer-stack", compact ? "yds-layer-stack--compact" : ""].filter(Boolean).join(" ")}
      aria-label="YDS 4계층 분석 스택"
    >
      <div className="yds-layer-stack__row yds-layer-stack__row--base">
        <span className="yds-layer-stack__tier">State</span>
        <span className="yds-layer-stack__state">
          {levelLabel ?? (ydsScore != null ? `점수 ${ydsScore}` : "—")}
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
        <span className="yds-layer-stack__tier">Momentum</span>
        <span className="yds-layer-stack__state">
          {momentumActive ? "⚠️ 단기 변화" : "🟢 안정"}
        </span>
      </div>
      <div className="yds-layer-stack__row">
        <span className="yds-layer-stack__tier">Regime</span>
        <span className="yds-layer-stack__state">{regimeLabel ?? "—"}</span>
      </div>
      <div
        className={[
          "yds-layer-stack__row",
          eventActive ? "yds-layer-stack__row--event" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span className="yds-layer-stack__tier">Event</span>
        <span className="yds-layer-stack__state">
          {eventActive ? "📢 시장 이벤트" : "—"}
        </span>
      </div>
    </div>
  )
}
