import { resolvePricePosition } from "../../content/ydsStockPickV5Insights.js"
import { resolveStockPickCardAction } from "../../content/ydsStockPickCardAction.js"

/**
 * V7 — 현재 위치 · 행동 (카드 상단 시그널)
 * @param {{ stock: import("../../content/ydsStockPickModel.js").StockPickView; variant?: 'default' | 'compact' }} props
 */
export default function YdsStockPickV7Signals({ stock, variant = "default" }) {
  const position = stock.pickMeta?.pricePosition ?? resolvePricePosition(stock)
  const action = resolveStockPickCardAction(stock)

  return (
    <div
      className={[
        "yds-spick-v7-signals",
        variant === "compact" ? "yds-spick-v7-signals--compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {position ? (
        <span className="yds-spick-v7-signals__position">
          현재 위치 {position.emoji} {position.label}
        </span>
      ) : null}
      <span
        className={[
          "yds-spick-v7-signals__action",
          action.id === "entry" ? "yds-spick-v7-signals__action--entry" : "",
          action.id === "waitPullback" ? "yds-spick-v7-signals__action--wait" : "",
          action.id === "noChase" ? "yds-spick-v7-signals__action--no-chase" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {action.emoji} {action.label}
      </span>
    </div>
  )
}
