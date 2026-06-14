import YdsStockPickQualityTimingHeader from "./YdsStockPickQualityTimingHeader.jsx"
import YdsStockPickTimingChecklist from "./YdsStockPickTimingChecklist.jsx"

/**
 * @param {{
 *   breakdown?: import("../../content/ydsStockPickPhase3Breakdown.js").Phase3ScoreBreakdown | null
 *   v4?: import("../../content/ydsStockPickV4Scoring.js").V4StockScore | null
 *   timing?: import("../../content/ydsStockPickTimingScore.js").TimingScoreResult | null
 *   variant?: 'detail' | 'card' | 'why'
 *   showDetails?: boolean
 * }} props
 */
export default function YdsStockPickPhase3Breakdown({
  stock = null,
  breakdown = null,
  v4 = null,
  timing = null,
  variant = "detail",
  showDetails = true,
}) {
  if (!breakdown && !v4 && !stock?.v4Score) return null

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
      <YdsStockPickQualityTimingHeader
        stock={stock}
        v4={v4 ?? stock?.v4Score}
        total={breakdown?.total ?? stock?.v4Score?.total}
        variant={variant === "why" ? "why" : variant === "card" ? "compact" : "detail"}
        showTotal={variant === "detail"}
      />

      {timing ? (
        <YdsStockPickTimingChecklist timing={timing} variant={variant === "detail" ? "detail" : "compact"} />
      ) : null}

      {showDetails && breakdown?.rows?.length ? (
        <>
          <p className="yds-spick-p3-breakdown__section-label">기업품질 구성</p>
          <ul className="yds-spick-p3-breakdown__list">
            {breakdown.rows
              .filter((r) => ["performance", "industry", "sector"].includes(r.key))
              .map((row) => (
              <li key={row.key} className="yds-spick-p3-breakdown__row">
                <span className="yds-spick-p3-breakdown__label">{row.label}</span>
                <span className="yds-spick-p3-breakdown__value font-mono tabular-nums">
                  {row.display}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}
