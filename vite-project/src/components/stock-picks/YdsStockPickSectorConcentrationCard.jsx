import { useMemo } from "react"
import { buildSectorConcentration } from "../../content/ydsStockPickSectorConcentration.js"

/**
 * @param {{
 *   stocks: import("../../content/ydsStockPickModel.js").StockPickView[]
 *   limit?: number
 *   className?: string
 * }} props
 */
export default function YdsStockPickSectorConcentrationCard({
  stocks,
  limit = 10,
  className = "",
}) {
  const view = useMemo(() => buildSectorConcentration(stocks, limit), [stocks, limit])
  if (!view) return null

  return (
    <section
      className={["yds-spick-sector-conc", className].filter(Boolean).join(" ")}
      aria-label="섹터 집중도"
    >
      <div className="yds-spick-sector-conc__head">
        <h2 className="yds-spick-sector-conc__title">섹터 집중도</h2>
        <span className={`yds-spick-sector-conc__grade yds-spick-sector-conc__grade--${view.grade.tone}`}>
          {view.grade.label}
        </span>
      </div>
      <p className="yds-spick-sector-conc__summary">{view.summary}</p>
      <ul className="yds-spick-sector-conc__bars">
        {view.weights.slice(0, 5).map((w) => (
          <li key={w.sector} className="yds-spick-sector-conc__bar-row">
            <span className="yds-spick-sector-conc__bar-label">{w.sector}</span>
            <span className="yds-spick-sector-conc__bar-track" aria-hidden>
              <span
                className="yds-spick-sector-conc__bar-fill"
                style={{ width: `${Math.max(w.pct, 4)}%` }}
              />
            </span>
            <span className="yds-spick-sector-conc__bar-pct font-mono tabular-nums">{w.pct}%</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
