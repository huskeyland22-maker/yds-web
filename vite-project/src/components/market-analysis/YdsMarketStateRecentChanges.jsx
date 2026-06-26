import { useMemo } from "react"
import { buildRecentMarketStateChanges } from "../../content/ydsMarketStateRecentChanges.js"

/**
 * @param {{
 *   historyRows?: object[]
 *   cycleFlow?: import("../../content/ydsMarketCycleFlow.js").MarketCycleFlowReport | null
 *   panicData?: object | null
 *   dualLiquidity?: import("../../market-os/liquidityDualEngine.js").DualLiquidityReport | null
 *   className?: string
 * }} props
 */
export default function YdsMarketStateRecentChanges({
  historyRows = [],
  cycleFlow = null,
  panicData = null,
  dualLiquidity = null,
  className = "",
}) {
  const report = useMemo(
    () => buildRecentMarketStateChanges(historyRows, cycleFlow, panicData, dualLiquidity),
    [historyRows, cycleFlow, panicData, dualLiquidity],
  )

  if (!report.visible) return null

  return (
    <section
      className={["yds-market-state-recent", className].filter(Boolean).join(" ")}
      aria-label="최근 시장 상태 변경"
    >
      <p className="yds-market-state-recent__title">최근 상태 변경</p>
      <ol className="yds-market-state-recent__list">
        {report.items.map((item) => (
          <li key={`${item.date}-${item.toLabel}`} className="yds-market-state-recent__item">
            <span className="yds-market-state-recent__when">{item.daysAgoLabel}</span>
            <div className="yds-market-state-recent__flow">
              <span className="yds-market-state-recent__label">{item.fromLabel}</span>
              <span className="yds-market-state-recent__arrow" aria-hidden>
                ↓
              </span>
              <span className="yds-market-state-recent__label yds-market-state-recent__label--to">
                {item.toLabel}
                {item.isCurrent ? (
                  <span className="yds-market-state-recent__current"> (현재 유지중)</span>
                ) : null}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
