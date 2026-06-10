import {
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
  const snap = stock.snapshot
  const close = snap?.price ?? snap?.close
  if (close == null || !Number.isFinite(Number(close))) return null

  const updatedAt = snap?.fetchedAt ?? stock.quote?.updatedAt ?? null

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
        {formatPickPrice(close, stock.country)}
      </span>
      {!compact && updatedAt ? (
        <span className="yds-spick-price__time">{formatQuoteUpdatedAt(updatedAt)}</span>
      ) : null}
    </div>
  )
}
