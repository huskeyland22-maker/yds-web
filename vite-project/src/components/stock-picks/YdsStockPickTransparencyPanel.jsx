import { useMemo } from "react"
import { buildStockPickTransparency } from "../../content/ydsStockPickTransparency.js"

/**
 * @param {{
 *   stock: import("../../content/ydsStockPickModel.js").StockPickView
 *   variant?: 'top5' | 'detail' | 'compact'
 * }} props
 */
export default function YdsStockPickTransparencyPanel({ stock, variant = "top5" }) {
  const transparency = useMemo(() => buildStockPickTransparency(stock), [stock])
  const isCompact = variant === "compact"

  return (
    <div
      className={[
        "yds-spick-transparency",
        variant === "top5" ? "yds-spick-transparency--top5" : "",
        variant === "detail" ? "yds-spick-transparency--detail" : "",
        isCompact ? "yds-spick-transparency--compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="yds-spick-transparency__status-card">
        <div className="yds-spick-transparency__row">
          <span className="yds-spick-transparency__key">상태</span>
          <span className="yds-spick-transparency__val">
            <span aria-hidden>{stock.stockStatus.emoji}</span> {stock.stockStatus.label}
          </span>
        </div>
        <div className="yds-spick-transparency__row">
          <span className="yds-spick-transparency__key">행동</span>
          <span className="yds-spick-transparency__val yds-spick-transparency__val--action">
            <span aria-hidden>{stock.stockAction.emoji}</span> {stock.stockAction.label}
          </span>
        </div>
      </div>

      {!isCompact ? (
        <dl className="yds-spick-transparency__metrics">
          {transparency.metrics.map((m) => (
            <div key={m.id} className="yds-spick-transparency__metric">
              <dt>{m.label}</dt>
              <dd className="font-mono tabular-nums">{m.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {transparency.rationale.length ? (
        <div className="yds-spick-transparency__rationale">
          <p className="yds-spick-transparency__rationale-title">근거</p>
          <ul className="yds-spick-transparency__rationale-list">
            {transparency.rationale.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
