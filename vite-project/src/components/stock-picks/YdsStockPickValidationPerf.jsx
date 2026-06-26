import { useMemo } from "react"
import {
  buildPickValidationPerfView,
  findValidationPickByTicker,
} from "../../content/ydsPickValidationLink.js"

/**
 * @param {{ ticker: string; country?: string; className?: string }} props
 */
export default function YdsStockPickValidationPerf({ ticker, country = "US", className = "" }) {
  const view = useMemo(() => {
    const record = findValidationPickByTicker(ticker, country)
    return buildPickValidationPerfView(record)
  }, [ticker, country])

  if (!view?.visible) return null

  return (
    <div
      className={["yds-spick-validation-perf", className].filter(Boolean).join(" ")}
      aria-label="성과검증 연동"
    >
      <p className="yds-spick-validation-perf__meta">
        추천 {view.recommendedAt}
        {view.recommendedPrice != null ? ` · ${view.recommendedPrice}` : ""}
        {view.marketStateLabel ? ` · ${view.marketStateLabel}` : ""}
        {view.panicScore != null ? ` · 패닉${view.panicScore}` : ""}
      </p>
      <ul className="yds-spick-validation-perf__rows">
        {view.rows.map((row) => (
          <li key={row.key} className="yds-spick-validation-perf__row">
            <span>{row.label}</span>
            <span className="font-mono tabular-nums">
              {row.returnPct != null ? `${row.returnPct > 0 ? "+" : ""}${row.returnPct}%` : "—"}
            </span>
            {row.outcome ? (
              <span className={`yds-spick-validation-perf__outcome yds-spick-validation-perf__outcome--${row.outcome.tone}`}>
                {row.outcome.emoji} {row.outcome.label}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
