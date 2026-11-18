import { useMemo } from "react"
import { buildMarketEnvStripModel } from "../../utils/ydsRuntimeEnvironment.js"

/**
 * Compact environment + panic core as-of strip for market-analysis (above ticker).
 * @param {{ panicData?: object | null, className?: string }} props
 */
export default function YdsMarketEnvStrip({ panicData = null, className = "" }) {
  const model = useMemo(() => buildMarketEnvStripModel(panicData), [panicData])

  return (
    <div
      className={["yds-market-env-strip", `yds-market-env-strip--${model.key}`, className]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-label={`실행 환경 ${model.label}`}
    >
      <div className="yds-market-env-strip__primary">
        <span className="yds-market-env-strip__env">{model.label}</span>
        <span className="yds-market-env-strip__sep" aria-hidden>
          ·
        </span>
        <span className="yds-market-env-strip__source">출처 {model.dataSource}</span>
        <span className="yds-market-env-strip__sep" aria-hidden>
          ·
        </span>
        <span
          className={[
            "yds-market-env-strip__state",
            `yds-market-env-strip__state--${String(model.scoreState).toLowerCase()}`,
          ].join(" ")}
        >
          {model.scoreState}
        </span>
      </div>
      <div className="yds-market-env-strip__meta font-mono tabular-nums">
        <span className="yds-market-env-strip__asof">{model.asOfSummary}</span>
        <span className="yds-market-env-strip__sep" aria-hidden>
          ·
        </span>
        <span className="yds-market-env-strip__updated">
          {model.updatedLabel ? `갱신 ${model.updatedLabel}` : "갱신 시각 없음"}
        </span>
      </div>
    </div>
  )
}
