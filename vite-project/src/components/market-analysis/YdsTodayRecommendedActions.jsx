import { useMemo } from "react"
import { buildTodayMarketConclusion } from "../../content/ydsTodayMarketConclusion.js"

/**
 * @param {{
 *   panicData?: object | null
 *   historyRows?: object[]
 *   cycleFlow?: import("../../content/ydsMarketCycleFlow.js").MarketCycleFlowReport | null
 *   dualLiquidity?: import("../../market-os/liquidityDualEngine.js").DualLiquidityReport | null
 *   etfContext?: { qqqPrices?: Record<string, number>; spyPrices?: Record<string, number>; asOfDate?: string | null } | null
 *   className?: string
 * }} props
 */
export default function YdsTodayRecommendedActions({
  panicData = null,
  historyRows = [],
  cycleFlow = null,
  dualLiquidity = null,
  etfContext = null,
  className = "",
}) {
  const report = useMemo(
    () =>
      buildTodayMarketConclusion(panicData, historyRows, dualLiquidity, cycleFlow, {
        spyPrices: etfContext?.spyPrices,
        qqqPrices: etfContext?.qqqPrices,
        asOfDate: etfContext?.asOfDate ?? null,
      }),
    [panicData, historyRows, dualLiquidity, cycleFlow, etfContext],
  )

  if (!report.actions.length) return null

  return (
    <section
      className={["yds-today-actions", className].filter(Boolean).join(" ")}
      aria-label="추천 행동"
    >
      <p className="yds-today-actions__title">추천 행동</p>
      <ul className="yds-today-actions__list">
        {report.actions.map((action) => (
          <li key={action} className="yds-today-actions__item">
            <span className="yds-today-actions__check" aria-hidden>
              ✓
            </span>
            {action}
          </li>
        ))}
      </ul>
    </section>
  )
}
