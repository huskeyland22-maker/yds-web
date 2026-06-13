import YdsStockPickScoreGrid from "./YdsStockPickScoreGrid.jsx"
import YdsStockPickUxStatusBadge from "./YdsStockPickUxStatusBadge.jsx"
/**
 * @param {{
 *   stock: import("../../content/ydsStockPickModel.js").StockPickView
 *   variant?: 'card' | 'top3' | 'top5' | 'detail' | 'inline' | 'compact'
 * }} props
 */
export default function YdsStockPickActionBlock({ stock, variant = "card" }) {
  const { stockAction } = stock
  const showScore = variant === "detail"
  const actionOnly = variant === "top5" || variant === "top3" || variant === "compact"
  const showStatus = !actionOnly

  return (
    <div
      className={[
        "yds-spick-action",
        variant === "top3" || variant === "top5" ? "yds-spick-action--top3" : "",
        variant === "detail" ? "yds-spick-action--detail" : "",
        variant === "inline" || variant === "compact" ? "yds-spick-action--inline" : "",
        actionOnly ? "yds-spick-action--action-only" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showStatus && showScore ? (
        <YdsStockPickScoreGrid decomposed={stock.decomposedScores} variant="detail" />
      ) : null}
      {showStatus ? (
        <div className="yds-spick-action__status">
          <YdsStockPickUxStatusBadge stock={stock} />
        </div>
      ) : null}

      <div className="yds-spick-action__row">
        {showScore ? <span className="yds-spick-action__action-label">행동</span> : null}
        <span className="yds-spick-action__action-value">
          <span className="yds-spick-action__action-emoji" aria-hidden>
            {stockAction.emoji}
          </span>
          {stockAction.label}
        </span>
      </div>
    </div>
  )
}
