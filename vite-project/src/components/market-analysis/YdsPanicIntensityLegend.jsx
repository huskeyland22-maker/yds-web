import { useMemo } from "react"
import {
  PANIC_INTENSITY_LEGEND_STAGES,
  resolvePanicIntensityLegendIndex,
} from "../../content/ydsPanicIntensityLegend.js"

/**
 * 패닉 강도 6단계 범례
 * @param {{
 *   score?: number | null
 *   className?: string
 *   compact?: boolean
 * }} props
 */
export default function YdsPanicIntensityLegend({
  score = null,
  className = "",
  compact = false,
}) {
  const currentIndex = useMemo(() => {
    if (score == null || !Number.isFinite(score)) return -1
    return resolvePanicIntensityLegendIndex(score)
  }, [score])

  return (
    <div
      className={[
        "yds-panic-intensity-legend",
        compact ? "yds-panic-intensity-legend--compact" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="패닉 강도 단계"
    >
      <div className="yds-panic-intensity-legend__track">
        {PANIC_INTENSITY_LEGEND_STAGES.map((stage, index) => {
          const isCurrent = index === currentIndex
          return (
            <div
              key={stage.id}
              className={[
                "yds-panic-intensity-legend__step",
                isCurrent ? "yds-panic-intensity-legend__step--current" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ "--legend-color": stage.color }}
            >
              {index > 0 ? (
                <span className="yds-panic-intensity-legend__sep" aria-hidden>
                  |
                </span>
              ) : null}
              <span className="yds-panic-intensity-legend__label">{stage.shortLabel}</span>
              {isCurrent ? (
                <span className="yds-panic-intensity-legend__marker">▲ 현재</span>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
