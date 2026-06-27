import YdsStockPickAiConfidenceBar from "./YdsStockPickAiConfidenceBar.jsx"

/**
 * @param {{
 *   stock: import("../../content/ydsStockPickModel.js").StockPickView
 *   className?: string
 * }} props
 */
export default function YdsStockPickScoreBreakdown({ stock, className = "" }) {
  const trust = stock.trustReport
  const bars = trust?.scoreBars ?? []
  const recScore = trust?.recommendScore ?? stock.recommendEngine?.compositeScore ?? stock.score ?? 0
  const conf = trust?.aiConfidence

  if (!bars.length && !conf) return null

  return (
    <details className={["yds-spick-score-breakdown", className].filter(Boolean).join(" ")}>
      <summary className="yds-spick-score-breakdown__summary">
        추천점수{" "}
        <strong className="font-mono tabular-nums">{Math.round(recScore)}</strong>
      </summary>
      {conf ? (
        <YdsStockPickAiConfidenceBar score={conf.score} className="yds-spick-score-breakdown__conf" />
      ) : null}
      {bars.length ? (
        <div className="yds-spick-detail-panel__scores yds-spick-score-breakdown__bars">
          {bars.map((bar) => (
            <div key={bar.id} className="yds-spick-detail-panel__score-row">
              <div className="yds-spick-detail-panel__score-head">
                <span className="yds-spick-detail-panel__score-label">{bar.label}</span>
                <span className="yds-spick-detail-panel__score-val font-mono tabular-nums">
                  {bar.score}
                </span>
              </div>
              <div className="yds-spick-detail-panel__bar-track">
                <span
                  className={[
                    "yds-spick-detail-panel__bar-fill",
                    bar.invertTone ? "yds-spick-detail-panel__bar-fill--risk" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ width: `${bar.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </details>
  )
}
