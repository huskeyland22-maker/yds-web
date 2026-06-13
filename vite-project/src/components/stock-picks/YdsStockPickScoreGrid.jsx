/**
 * @param {{
 *   decomposed?: import("../../content/ydsStockPickDecomposedScores.js").DecomposedStockScores | null
 *   variant?: 'card' | 'compact' | 'detail' | 'why'
 *   showTotal?: boolean
 * }} props
 */
export default function YdsStockPickScoreGrid({
  decomposed = null,
  variant = "card",
  showTotal = true,
}) {
  if (!decomposed?.rows?.length) return null

  return (
    <div
      className={[
        "yds-spick-score-grid",
        variant === "compact" ? "yds-spick-score-grid--compact" : "",
        variant === "detail" ? "yds-spick-score-grid--detail" : "",
        variant === "why" ? "yds-spick-score-grid--why" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showTotal ? (
        <p className="yds-spick-score-grid__total font-mono tabular-nums">
          종합점수 <strong>{decomposed.total}</strong>
        </p>
      ) : null}
      <div className="yds-spick-score-grid__subs">
        {decomposed.rows.map((row) => (
          <div key={row.key} className="yds-spick-score-grid__cell">
            <span className="yds-spick-score-grid__label">{row.label}</span>
            <span className="yds-spick-score-grid__value font-mono tabular-nums">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
