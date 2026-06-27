const CIRCLED = ["①", "②", "③", "④", "⑤"]

/**
 * @param {{
 *   topReasons?: { order: number; text: string }[]
 *   detailReasons?: string[]
 *   items?: import("../../content/ydsStockPickRecommendRationale.js").RecommendRationale[]
 *   maxItems?: number
 *   title?: string
 *   className?: string
 * }} props
 */
export default function YdsStockPickRecommendRationale({
  topReasons,
  detailReasons = [],
  items,
  maxItems = 3,
  title = "추천 근거",
  className = "",
}) {
  const tops =
    topReasons?.length > 0
      ? topReasons.slice(0, maxItems)
      : (items ?? []).slice(0, maxItems).map((item, index) => ({
          order: index + 1,
          text: item.text,
        }))

  if (!tops.length) return null

  const details = detailReasons.filter((line) => !tops.some((t) => t.text === line))

  return (
    <div className={["yds-spick-rationale", className].filter(Boolean).join(" ")} aria-label="추천 근거">
      <p className="yds-spick-rationale__title">{title}</p>
      <ul className="yds-spick-rationale__list">
        {tops.map((item) => (
          <li key={`${item.order}-${item.text}`} className="yds-spick-rationale__item">
            <span className="yds-spick-rationale__mark" aria-hidden>
              {CIRCLED[item.order - 1] ?? `${item.order}.`}
            </span>
            <span className="yds-spick-rationale__text">{item.text}</span>
          </li>
        ))}
      </ul>
      {details.length ? (
        <details className="yds-spick-rationale__details">
          <summary className="yds-spick-rationale__details-summary">상세 데이터</summary>
          <ul className="yds-spick-rationale__details-list">
            {details.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}
