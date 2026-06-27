import { resolveRecommendStatusView } from "../../content/ydsStockPickRecommendColors.js"

/**
 * @param {{
 *   stock: import("../../content/ydsStockPickModel.js").StockPickView
 *   className?: string
 *   compact?: boolean
 * }} props
 */
export default function YdsStockPickRecommendStatusBadge({
  stock,
  className = "",
  compact = false,
}) {
  const view = resolveRecommendStatusView(stock)

  return (
    <span
      className={[
        "yds-spick-rec-status",
        compact ? "yds-spick-rec-status--compact" : "",
        `yds-spick-rec-status--${view.tone}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      title={view.tooltip}
      aria-label={`${view.label}. ${view.tooltip}`}
    >
      <span className="yds-spick-rec-status__dot" aria-hidden />
      {view.label}
    </span>
  )
}
