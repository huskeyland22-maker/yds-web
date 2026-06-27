import YdsStockPickRecommendStatusBadge from "./YdsStockPickRecommendStatusBadge.jsx"
import YdsStockPickNoChaseReasons from "./YdsStockPickNoChaseReasons.jsx"
import { resolveRecommendStatusView } from "../../content/ydsStockPickRecommendColors.js"

/**
 * @param {{
 *   stock: import("../../content/ydsStockPickModel.js").StockPickView
 *   className?: string
 * }} props
 */
export default function YdsStockPickUxStatusBadge({ stock, className = "" }) {
  const view = resolveRecommendStatusView(stock)
  const noChaseReasons = stock.pickMeta?.noChaseReasons ?? []

  return (
    <span className={["yds-spick-ux-status-wrap", className].filter(Boolean).join(" ")}>
      <YdsStockPickRecommendStatusBadge stock={stock} />
      {view.id === "noChase" && noChaseReasons.length ? (
        <YdsStockPickNoChaseReasons reasons={noChaseReasons} className="yds-spick-ux-status__reasons" />
      ) : null}
    </span>
  )
}
