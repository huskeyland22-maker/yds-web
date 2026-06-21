/**
 * @param {{
 *   lifecycle: import("../../content/ydsStockPickLifecycle.js").LifecycleView | null | undefined
 *   className?: string
 * }} props
 */
export default function YdsStockPickLifecycleBadge({ lifecycle, className = "" }) {
  if (!lifecycle || lifecycle.id === "excluded") return null

  return (
    <div className={["yds-spick-lifecycle", className].filter(Boolean).join(" ")} aria-label="수명주기">
      <span className={`yds-spick-lifecycle__state yds-spick-lifecycle__state--${lifecycle.tone}`}>
        {lifecycle.label}
      </span>
      <span className="yds-spick-lifecycle__hint">{lifecycle.hint}</span>
    </div>
  )
}
