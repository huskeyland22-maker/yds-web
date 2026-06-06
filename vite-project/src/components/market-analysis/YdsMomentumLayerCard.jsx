import { useMemo } from "react"
import { resolveMomentumLayer } from "../../content/ydsMomentumLayer.js"

/**
 * Momentum Layer — CNN·BofA 단기 변화 (장기 절대값과 분리)
 * @param {{
 *   panicData?: object | null
 *   historyRows?: object[]
 *   fearStageLabel?: string
 *   compact?: boolean
 * }} props
 */
export default function YdsMomentumLayerCard({
  panicData = null,
  historyRows = [],
  fearStageLabel = "",
  compact = false,
}) {
  const view = useMemo(
    () =>
      resolveMomentumLayer(panicData, historyRows, {
        fearStageLabel,
      }),
    [panicData, historyRows, fearStageLabel],
  )

  if (!view.hasData && view.level === "none") {
    return (
      <section
        className={["yds-momentum", compact ? "yds-momentum--compact" : ""].filter(Boolean).join(" ")}
        aria-label="단기 Momentum"
      >
        <div className="yds-momentum__row">
          <p className="yds-momentum__label">단기 상태</p>
          <p className="yds-momentum__value yds-momentum__value--calm">
            🟢 단기 안정
          </p>
        </div>
        <p className="yds-momentum__hint">히스토리 축적 후 CNN·BofA 변화율을 표시합니다.</p>
      </section>
    )
  }

  return (
    <section
      className={[
        "yds-momentum",
        compact ? "yds-momentum--compact" : "",
        view.level !== "none" ? "yds-momentum--active" : "",
        view.level === "strong" ? "yds-momentum--strong" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="단기 Momentum Layer"
    >
      <div className="yds-momentum__row">
        <p className="yds-momentum__label">단기 상태</p>
        <p
          className={[
            "yds-momentum__value",
            view.level !== "none" ? "yds-momentum__value--warn" : "yds-momentum__value--calm",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {view.emoji} {view.shortLabel}
        </p>
      </div>

      {!compact && view.level !== "none" ? (
        <div className="yds-momentum__metrics font-mono tabular-nums">
          {view.cnnDelta3d != null ? (
            <span>CNN 3일 {view.cnnDelta3d > 0 ? "+" : ""}{Math.round(view.cnnDelta3d)}</span>
          ) : null}
          {view.bofaDelta2w != null ? (
            <span>BofA 2주 {view.bofaDelta2w > 0 ? "+" : ""}{view.bofaDelta2w.toFixed(1)}</span>
          ) : null}
        </div>
      ) : null}

      {view.explainLines.length ? (
        <div className="yds-momentum__explain">
          {view.explainLines.map((line) => (
            <p key={line} className="yds-momentum__explain-line">
              {line}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  )
}

export { resolveMomentumLayer }
