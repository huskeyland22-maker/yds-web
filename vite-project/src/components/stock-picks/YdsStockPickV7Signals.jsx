import { resolveStockPickCardAction } from "../../content/ydsStockPickCardAction.js"

/**
 * V7 — 행동 시그널 (현재 위치는 YdsStockPositionBadge)
 * @param {{ stock: import("../../content/ydsStockPickModel.js").StockPickView; variant?: 'default' | 'compact' }} props
 */
export default function YdsStockPickV7Signals({ stock, variant = "default" }) {
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
