/**
 * @param {{
 *   timing?: import("../../content/ydsStockPickTimingScore.js").TimingScoreResult | null
 *   positionLabel?: string | null
 *   variant?: 'detail' | 'compact'
 * }} props
 */
export default function YdsStockPickTimingChecklist({
  timing = null,
  positionLabel = null,
  variant = "detail",
}) {
  if (!timing?.checks?.length) return null

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
        기술적 위치 <strong>{timing.score}</strong>/{timing.max}
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
      {positionLabel ? <p className="yds-spick-timing-check__position">현재 : {positionLabel}</p> : null}
      {timing.rsiPenalty > 0 ? (
        <p className="yds-spick-timing-check__penalty font-mono tabular-nums">
          RSI 과열 감점 −{timing.rsiPenalty}
        </p>
      ) : null}
    </div>
  )
}
