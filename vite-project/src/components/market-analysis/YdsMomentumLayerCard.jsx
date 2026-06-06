import { useMemo } from "react"
import { resolveMomentumStatusLabel } from "../../content/ydsStatusLabels.js"
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
  const { layer, status } = useMemo(() => {
    const layerView = resolveMomentumLayer(panicData, historyRows, { fearStageLabel })
    return {
      layer: layerView,
      status: resolveMomentumStatusLabel(layerView),
    }
  }, [panicData, historyRows, fearStageLabel])

  if (!layer.hasData && layer.level === "none") {
    return (
      <section
        className={["yds-momentum", compact ? "yds-momentum--compact" : ""].filter(Boolean).join(" ")}
        aria-label="단기 Momentum"
      >
        <div className="yds-momentum__row">
          <p className="yds-momentum__label">Momentum</p>
          <p className="yds-momentum__value yds-momentum__value--calm">
            {status.emoji} {status.label}
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
        layer.level !== "none" ? "yds-momentum--active" : "",
        status.tier === "riskOff" ? "yds-momentum--strong" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="단기 Momentum Layer"
    >
      <div className="yds-momentum__row">
        <p className="yds-momentum__label">Momentum</p>
        <p
          className={[
            "yds-momentum__value",
            layer.level !== "none" ? "yds-momentum__value--warn" : "yds-momentum__value--calm",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{ "--momentum-status-color": status.color }}
        >
          {status.emoji} {status.label}
        </p>
      </div>

      {!compact && layer.level !== "none" ? (
        <div className="yds-momentum__metrics font-mono tabular-nums">
          {layer.cnnDelta3d != null ? (
            <span>CNN {layer.cnnDelta3d > 0 ? "+" : ""}{Math.round(layer.cnnDelta3d)}p</span>
          ) : null}
          {layer.bofaDelta2w != null ? (
            <span>BofA {layer.bofaDelta2w > 0 ? "+" : ""}{layer.bofaDelta2w.toFixed(1)}</span>
          ) : null}
        </div>
      ) : null}

      {layer.explainLines.length ? (
        <div className="yds-momentum__explain">
          {layer.explainLines.map((line) => (
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
