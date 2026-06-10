import { resolveStockPickUxStatus } from "../../content/ydsStockPickUxStatus.js"

/**
 * @param {{
 *   stock: import("../../content/ydsStockPickModel.js").StockPickView
 *   className?: string
 * }} props
 */
export default function YdsStockPickUxStatusBadge({ stock, className = "" }) {
  const ux = resolveStockPickUxStatus(stock)

  return (
    <span
      className={["yds-spick-ux-status", className].filter(Boolean).join(" ")}
      title={ux.tooltip}
      aria-label={`${ux.label}. ${ux.tooltip}`}
    >
      <span className="yds-spick-ux-status__emoji" aria-hidden>
        {ux.emoji}
      </span>{" "}
      <span className="yds-spick-ux-status__label">{ux.label}</span>
    </span>
  )
}
