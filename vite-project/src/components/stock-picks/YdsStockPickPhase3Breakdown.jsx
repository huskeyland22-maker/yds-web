import {
  PHASE3_QUALITY_MAX,
  PHASE3_TIMING_MAX,
} from "../../content/ydsStockPickPhase3Breakdown.js"

/**
 * @param {{
 *   breakdown?: import("../../content/ydsStockPickPhase3Breakdown.js").Phase3ScoreBreakdown | null
 *   technical?: import("../../content/ydsStockTechnicalScore.js").TechnicalScoreResult | null
 *   variant?: 'detail' | 'card' | 'why'
 *   showQualityTiming?: boolean
 * }} props
 */
export default function YdsStockPickPhase3Breakdown({
  breakdown = null,
  technical = null,
  variant = "detail",
  showQualityTiming = true,
}) {
  if (!breakdown?.rows?.length) return null

  return (
    <div
      className={[
        "yds-spick-p3-breakdown",
        variant === "card" ? "yds-spick-p3-breakdown--card" : "",
        variant === "why" ? "yds-spick-p3-breakdown--why" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="yds-spick-p3-breakdown__total font-mono tabular-nums">
        종합점수 <strong>{breakdown.total}</strong>
      </p>

      {showQualityTiming ? (
        <div className="yds-spick-p3-breakdown__split">
          <span className="yds-spick-p3-breakdown__split-item font-mono tabular-nums">
            품질 <strong>{breakdown.quality}</strong>/{PHASE3_QUALITY_MAX}
          </span>
          <span className="yds-spick-p3-breakdown__split-item font-mono tabular-nums">
            타이밍 <strong>{breakdown.timing}</strong>/{PHASE3_TIMING_MAX}
          </span>
          {technical ? (
            <span className="yds-spick-p3-breakdown__split-item font-mono tabular-nums">
              기술 <strong>{technical.score}</strong>/{technical.max}
            </span>
          ) : null}
        </div>
      ) : null}

      <ul className="yds-spick-p3-breakdown__list">
        {breakdown.rows.map((row) => (
          <li key={row.key} className="yds-spick-p3-breakdown__row">
            <span className="yds-spick-p3-breakdown__label">{row.label}</span>
            <span className="yds-spick-p3-breakdown__value font-mono tabular-nums">
              {row.display}
            </span>
          </li>
        ))}
      </ul>

      <p className="yds-spick-p3-breakdown__sum font-mono tabular-nums">
        총점 <strong>{breakdown.total}</strong>
      </p>
    </div>
  )
}
