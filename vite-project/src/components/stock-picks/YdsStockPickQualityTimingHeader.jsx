import { PHASE3_QUALITY_MAX } from "../../content/ydsStockPickPhase3Breakdown.js"
import { TIMING_SCORE_MAX } from "../../content/ydsStockPickTimingScore.js"

/**
 * @param {{
 *   stock?: import("../../content/ydsStockPickModel.js").StockPickView | null
 *   v4?: import("../../content/ydsStockPickV4Scoring.js").V4StockScore | null
 *   total?: number | null
 *   variant?: 'card' | 'detail' | 'why' | 'compact'
 *   showTotal?: boolean
 * }} props
 */
export default function YdsStockPickQualityTimingHeader({
  stock = null,
  v4 = null,
  total = null,
  variant = "card",
  showTotal = variant !== "compact",
}) {
  const score = v4 ?? stock?.v4Score
  const meta = stock?.pickMeta
  if (!score) return null

  const displayTotal = total ?? score.total
  const qualityGrade = score.qualityDisplayGrade ?? score.qualityGrade

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
            "yds-spick-v4-header__grade--primary",
            qualityGrade === "A+" ? "yds-spick-v4-header__grade--q-aplus" : "",
            `yds-spick-v4-header__grade--q-${String(qualityGrade).replace("+", "plus").toLowerCase()}`,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          기업품질{" "}
          <strong className="font-mono tabular-nums">
            {qualityGrade} ({score.quality}/{PHASE3_QUALITY_MAX})
          </strong>
        </span>
        <span
          className={[
            "yds-spick-v4-header__grade",
            `yds-spick-v4-header__grade--t-${score.timingGrade.toLowerCase()}`,
          ].join(" ")}
        >
          타이밍{" "}
          <strong className="font-mono tabular-nums">
            {score.timingGrade} ({score.timing}/{TIMING_SCORE_MAX})
          </strong>
        </span>
        {meta ? (
          <span className="yds-spick-v4-header__grade yds-spick-v4-header__grade--market">
            시장적합{" "}
            <strong className="font-mono tabular-nums">
              {meta.marketFitGrade} ({meta.marketFitScore}/15)
            </strong>
          </span>
        ) : null}
      </div>
      {showTotal && displayTotal != null ? (
        <p className="yds-spick-v4-header__total yds-spick-v4-header__total--ref font-mono tabular-nums">
          종합 <strong>{displayTotal}</strong>
          <span className="yds-spick-v4-header__ref-note"> (참고)</span>
        </p>
      ) : null}
    </div>
  )
}
