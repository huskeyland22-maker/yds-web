/**
 * @param {{
 *   timing?: import("../../content/ydsStockPickTimingScore.js").TimingScoreResult | null
 *   variant?: 'detail' | 'compact'
 * }} props
 */
export default function YdsStockPickTimingChecklist({
  timing = null,
  variant = "detail",
}) {
  if (!timing?.checks?.length) return null

  const visibleChecks = timing.checks.filter((c) => c.id !== "rsi" || !c.pass || c.id === "rsi")

  return (
    <div
      className={[
        "yds-spick-timing-check",
        variant === "compact" ? "yds-spick-timing-check--compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="yds-spick-timing-check__title font-mono tabular-nums">
        타이밍 <strong>{timing.score}</strong>/{timing.max}
      </p>
      <ul className="yds-spick-timing-check__list">
        {timing.checks.map((item) => (
          <li
            key={item.id}
            className={[
              "yds-spick-timing-check__item",
              item.pass ? "yds-spick-timing-check__item--pass" : "yds-spick-timing-check__item--fail",
            ].join(" ")}
          >
            <span className="yds-spick-timing-check__mark" aria-hidden>
              {item.pass ? "✓" : "✗"}
            </span>
            <span className="yds-spick-timing-check__label">
              {item.id === "rsi" ? "RSI 과열" : item.shortLabel}
            </span>
          </li>
        ))}
      </ul>
      {timing.rsiPenalty > 0 ? (
        <p className="yds-spick-timing-check__penalty font-mono tabular-nums">
          RSI 과열 감점 −{timing.rsiPenalty}
        </p>
      ) : null}
    </div>
  )
}
