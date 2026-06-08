/**
 * @param {{
 *   scores: import("../../content/ydsStockScoreConfig.js").YdsScoreBreakdown
 *   rows: ReturnType<typeof import("../../content/ydsStockScoreConfig.js").formatScoreBreakdownRows>
 *   variant?: 'card' | 'detail' | 'inline'
 * }} props
 */
export default function YdsStockScoreBreakdown({ scores, rows, variant = "card" }) {
  return (
    <div
      className={[
        "yds-spick-scores",
        variant === "detail" ? "yds-spick-scores--detail" : "",
        variant === "inline" ? "yds-spick-scores--inline" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="yds-spick-scores__total font-mono tabular-nums">
        YDS 점수 <strong>{scores.totalScore}</strong>
      </p>
      <ul className="yds-spick-scores__list">
        {rows.map((row) => (
          <li key={row.id} className="yds-spick-scores__item">
            <span className="yds-spick-scores__label">{row.label}</span>
            <span className="yds-spick-scores__value font-mono tabular-nums">{row.display}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
