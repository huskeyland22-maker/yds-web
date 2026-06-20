import { useMemo } from "react"
import { resolveStockPosition } from "../../content/ydsStockPositionEngine.js"

/**
 * @param {{
 *   stock: import("../../content/ydsStockPickModel.js").StockPickView
 *   variant?: 'card' | 'inline' | 'detail'
 *   showScore?: boolean
 *   className?: string
 * }} props
 */
export default function YdsStockPositionBadge({
  stock,
  variant = "card",
  showScore = variant === "card",
  className = "",
}) {
  const position = useMemo(
    () => stock.pickMeta?.positionState ?? resolveStockPosition(stock),
    [stock],
  )
  const totalScore = Math.round(
    stock.v4Score?.finalRankScore ?? stock.v4Score?.total ?? stock.score ?? 0,
  )

  if (variant === "inline") {
    return (
      <span
        className={[
          "yds-spick-position",
          "yds-spick-position--inline",
          `yds-spick-position--${position.tone}`,
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        title={position.interpretation}
      >
        {position.label}
      </span>
    )
  }

  return (
    <div
      className={[
        "yds-spick-position",
        variant === "detail" ? "yds-spick-position--detail" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showScore ? (
        <p className="yds-spick-position__score font-mono tabular-nums">
          추천점수 <strong>{totalScore}</strong>
        </p>
      ) : null}
      <div className="yds-spick-position__row">
        <span className="yds-spick-position__label">현재상태</span>
        <span
          className={["yds-spick-position__badge", `yds-spick-position--${position.tone}`].join(" ")}
          title={position.signals?.join(" · ")}
        >
          {position.label}
        </span>
      </div>
      <p className="yds-spick-position__hint">{position.interpretation}</p>
    </div>
  )
}
