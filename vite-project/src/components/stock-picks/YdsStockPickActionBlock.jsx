/**
 * @param {{
 *   stock: import("../../content/ydsStockPickModel.js").StockPickView
 *   variant?: 'card' | 'top3' | 'detail' | 'inline'
 * }} props
 */
export default function YdsStockPickActionBlock({ stock, variant = "card" }) {
  const { stockStatus, stockAction, scores } = stock
  const showScore = variant === "detail"

  return (
    <div
      className={[
        "yds-spick-action",
        variant === "top3" ? "yds-spick-action--top3" : "",
        variant === "detail" ? "yds-spick-action--detail" : "",
        variant === "inline" ? "yds-spick-action--inline" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="yds-spick-action__status">
        <span className="yds-spick-action__status-emoji" aria-hidden>
          {stockStatus.emoji}
        </span>
        <span className="yds-spick-action__status-label">{stockStatus.label}</span>
        {showScore ? (
          <span className="yds-spick-action__score font-mono tabular-nums">
            {scores.totalScore}점
          </span>
        ) : null}
      </div>

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
