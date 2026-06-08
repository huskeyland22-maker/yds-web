import {
  formatPickChangePct,
  formatPickPrice,
  formatQuoteUpdatedAt,
} from "../../content/ydsStockPickQuoteService.js"

/**
 * @param {{
 *   stock: import("../../content/ydsStockPickModel.js").StockPickView
 *   compact?: boolean
 * }} props
 */
export default function YdsStockPickPriceLine({ stock, compact = false }) {
  const quote = stock.quote
  if (!quote?.price) return null

  const changePct = quote.changePct
  const tone =
    changePct == null ? "flat" : changePct > 0 ? "up" : changePct < 0 ? "down" : "flat"

  return (
    <div
      className={[
        "yds-spick-price",
        compact ? "yds-spick-price--compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="yds-spick-price__value font-mono tabular-nums">
        {formatPickPrice(quote.price, stock.country)}
      </span>
      <span
        className={[
          "yds-spick-price__chg font-mono tabular-nums",
          `yds-spick-price__chg--${tone}`,
        ].join(" ")}
      >
        {formatPickChangePct(changePct)}
      </span>
      {!compact && quote.updatedAt ? (
        <span className="yds-spick-price__time">{formatQuoteUpdatedAt(quote.updatedAt)}</span>
      ) : null}
    </div>
  )
}
