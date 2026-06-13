/**
 * @param {{
 *   technical?: import("../../content/ydsStockTechnicalScore.js").TechnicalScoreResult | null
 *   variant?: 'detail' | 'compact'
 * }} props
 */
export default function YdsStockPickTechnicalChecklist({
  technical = null,
  variant = "detail",
}) {
  if (!technical?.checks?.length) return null

  return (
    <div
      className={[
        "yds-spick-tech-check",
        variant === "compact" ? "yds-spick-tech-check--compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="yds-spick-tech-check__title font-mono tabular-nums">
        기술점수 <strong>{technical.score}</strong>/{technical.max}
      </p>
      <ul className="yds-spick-tech-check__list">
        {technical.checks.map((item) => (
          <li
            key={item.id}
            className={[
              "yds-spick-tech-check__item",
              item.pass ? "yds-spick-tech-check__item--pass" : "yds-spick-tech-check__item--fail",
            ].join(" ")}
          >
            <span className="yds-spick-tech-check__mark" aria-hidden>
              {item.pass ? "✓" : "✗"}
            </span>
            <span className="yds-spick-tech-check__label">
              {item.id === "rsi" && !item.pass ? "RSI 과열" : item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
