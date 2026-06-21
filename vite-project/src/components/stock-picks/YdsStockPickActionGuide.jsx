/**
 * @param {{
 *   guide: import("../../content/ydsStockPickActionGuide.js").ActionGuideView | null | undefined
 *   className?: string
 * }} props
 */
export default function YdsStockPickActionGuide({ guide, className = "" }) {
  if (!guide?.summary) return null

  return (
    <div className={["yds-spick-action-guide", className].filter(Boolean).join(" ")} aria-label="행동 가이드">
      <p className="yds-spick-action-guide__title">행동 가이드</p>
      <p className="yds-spick-action-guide__line">
        <span className="yds-spick-action-guide__mark" aria-hidden>
          ✓
        </span>
        <span className="yds-spick-action-guide__text">{guide.summary}</span>
      </p>
    </div>
  )
}
