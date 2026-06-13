import { PHASE3_QUALITY_MAX } from "../../content/ydsStockPickPhase3Breakdown.js"
import { TIMING_SCORE_MAX } from "../../content/ydsStockPickTimingScore.js"

/**
 * @param {{
 *   v4?: import("../../content/ydsStockPickV4Scoring.js").V4StockScore | null
 *   total?: number | null
 *   variant?: 'card' | 'detail' | 'why' | 'compact'
 * }} props
 */
export default function YdsStockPickQualityTimingHeader({
  v4 = null,
  total = null,
  variant = "card",
}) {
  if (!v4) return null

  const displayTotal = total ?? v4.total

  return (
    <div
      className={[
        "yds-spick-v4-header",
        variant === "compact" ? "yds-spick-v4-header--compact" : "",
        variant === "detail" ? "yds-spick-v4-header--detail" : "",
        variant === "why" ? "yds-spick-v4-header--why" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="yds-spick-v4-header__grades">
        <span
          className={[
            "yds-spick-v4-header__grade",
            `yds-spick-v4-header__grade--q-${v4.qualityGrade.toLowerCase()}`,
          ].join(" ")}
        >
          기업품질{" "}
          <strong className="font-mono tabular-nums">
            {v4.qualityGrade} ({v4.quality}/{PHASE3_QUALITY_MAX})
          </strong>
        </span>
        <span
          className={[
            "yds-spick-v4-header__grade",
            `yds-spick-v4-header__grade--t-${v4.timingGrade.toLowerCase()}`,
          ].join(" ")}
        >
          타이밍{" "}
          <strong className="font-mono tabular-nums">
            {v4.timingGrade} ({v4.timing}/{TIMING_SCORE_MAX})
          </strong>
        </span>
      </div>
      {displayTotal != null ? (
        <p className="yds-spick-v4-header__total font-mono tabular-nums">
          종합점수 <strong>{displayTotal}</strong>
        </p>
      ) : null}
    </div>
  )
}
