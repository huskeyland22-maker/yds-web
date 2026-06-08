/**
 * @param {{
 *   reasons: import("../../content/ydsStockRecommendReasons.js").RecommendReason[]
 *   variant?: 'card' | 'top3' | 'detail' | 'inline'
 *   title?: string
 * }} props
 */
export default function YdsStockPickReasons({
  reasons,
  variant = "card",
  title = "추천 이유",
}) {
  if (!reasons.length) return null

  return (
    <div
      className={[
        "yds-spick-reasons",
        variant === "top3" ? "yds-spick-reasons--top3" : "",
        variant === "detail" ? "yds-spick-reasons--detail" : "",
        variant === "inline" ? "yds-spick-reasons--inline" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="yds-spick-reasons__title">{title}</p>
      <ul className="yds-spick-reasons__list">
        {reasons.map((reason) => (
          <li
            key={reason.id}
            className={[
              "yds-spick-reasons__item",
              `yds-spick-reasons__item--${reason.tone}`,
            ].join(" ")}
          >
            <span className="yds-spick-reasons__emoji" aria-hidden>
              {reason.emoji}
            </span>
            <span className="yds-spick-reasons__text">{reason.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
