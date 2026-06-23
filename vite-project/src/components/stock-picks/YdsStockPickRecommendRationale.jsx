/**
 * @param {{
 *   items: import("../../content/ydsStockPickRecommendRationale.js").RecommendRationale[]
 *   maxItems?: number
 *   title?: string
 *   className?: string
 * }} props
 */
export default function YdsStockPickRecommendRationale({
  items,
  maxItems = 4,
  title = "추천 근거",
  className = "",
}) {
  if (!items?.length) return null

  const visible = items.slice(0, maxItems)

  return (
    <div className={["yds-spick-rationale", className].filter(Boolean).join(" ")} aria-label="추천 근거">
      <p className="yds-spick-rationale__title">{title}</p>
      <ul className="yds-spick-rationale__list">
        {visible.map((item) => (
          <li key={item.id} className="yds-spick-rationale__item">
            <span className="yds-spick-rationale__mark" aria-hidden>
              ✓
            </span>
            <span className="yds-spick-rationale__text">{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
