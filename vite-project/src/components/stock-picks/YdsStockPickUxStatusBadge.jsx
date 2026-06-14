import { resolveStockPickUxStatus } from "../../content/ydsStockPickUxStatus.js"
import YdsStockPickNoChaseReasons from "./YdsStockPickNoChaseReasons.jsx"

/**
 * @param {{
 *   stock: import("../../content/ydsStockPickModel.js").StockPickView
 *   className?: string
 * }} props
 */
export default function YdsStockPickUxStatusBadge({ stock, className = "" }) {
  const ux = resolveStockPickUxStatus(stock)
  const noChaseReasons = stock.pickMeta?.noChaseReasons ?? []

  return (
    <span className={["yds-spick-ux-status-wrap", className].filter(Boolean).join(" ")}>
      <span
        className="yds-spick-ux-status"
        title={ux.tooltip}
        aria-label={`${ux.label}. ${ux.tooltip}`}
      >
        <span className="yds-spick-ux-status__emoji" aria-hidden>
          {ux.emoji}
        </span>{" "}
        <span className="yds-spick-ux-status__label">{ux.label}</span>
      </span>
      {ux.id === "noChase" && noChaseReasons.length ? (
        <YdsStockPickNoChaseReasons reasons={noChaseReasons} className="yds-spick-ux-status__reasons" />
      ) : null}
    </span>
  )
}
