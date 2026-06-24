import { useMemo } from "react"
import { buildMarketDeskSummary } from "../../content/ydsMarketDeskSummary.js"

/**
 * @param {{
 *   panicData?: object | null
 *   dualLiquidity?: import("../../market-os/liquidityDualEngine.js").DualLiquidityReport | null
 *   cycleFlow?: import("../../content/ydsMarketCycleFlow.js").MarketCycleFlowReport | null
 *   className?: string
 * }} props
 */
export default function YdsMarketDeskSummary({
  panicData = null,
  dualLiquidity = null,
  cycleFlow = null,
  className = "",
}) {
  const summary = useMemo(
    () => buildMarketDeskSummary(panicData, dualLiquidity, cycleFlow),
    [panicData, dualLiquidity, cycleFlow],
  )

  if (!summary?.lines?.length) return null

  return (
    <section
      className={["yds-market-desk-summary", className].filter(Boolean).join(" ")}
      aria-label={summary.title}
    >
      <p className="yds-market-desk-summary__title">{summary.title}</p>
      <ul className="yds-market-desk-summary__lines">
        {summary.lines.map((line) => (
          <li key={line} className="yds-market-desk-summary__line">
            {line}
          </li>
        ))}
      </ul>
    </section>
  )
}
