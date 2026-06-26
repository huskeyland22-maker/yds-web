import { useMemo } from "react"
import { buildMarketStateChangeTimeline } from "../../content/ydsMarketStateRecentChanges.js"

/**
 * @param {{
 *   historyRows?: object[]
 *   cycleFlow?: import("../../content/ydsMarketCycleFlow.js").MarketCycleFlowReport | null
 *   panicData?: object | null
 *   dualLiquidity?: import("../../market-os/liquidityDualEngine.js").DualLiquidityReport | null
 *   etfContext?: { qqqPrices?: Record<string, number>; spyPrices?: Record<string, number> } | null
 *   className?: string
 * }} props
 */
export default function YdsMarketStateRecentChanges({
  historyRows = [],
  cycleFlow = null,
  panicData = null,
  dualLiquidity = null,
  etfContext = null,
  className = "",
}) {
  const report = useMemo(
    () =>
      buildMarketStateChangeTimeline(historyRows, cycleFlow, panicData, dualLiquidity, {
        etfContext,
      }),
    [historyRows, cycleFlow, panicData, dualLiquidity, etfContext],
  )

  if (!report.visible) return null

  return (
    <section
      className={["yds-market-state-timeline", className].filter(Boolean).join(" ")}
      aria-label={report.title}
    >
      <p className="yds-market-state-timeline__title">{report.title}</p>
      <ol className="yds-market-state-timeline__list">
        {report.segments.map((seg, index) => (
          <li
            key={`${seg.startDate}-${seg.label}-${index}`}
            className={[
              "yds-market-state-timeline__item",
              seg.isCurrent ? "yds-market-state-timeline__item--current" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="yds-market-state-timeline__rail" aria-hidden>
              {seg.isCurrent ? (
                <span className="yds-market-state-timeline__dot">●</span>
              ) : (
                <span className="yds-market-state-timeline__node" />
              )}
              {index < report.segments.length - 1 ? (
                <span className="yds-market-state-timeline__connector" />
              ) : null}
            </div>

            <div
              className="yds-market-state-timeline__body"
              tabIndex={0}
              title={seg.tooltipLines.join(" · ")}
            >
              <div className="yds-market-state-timeline__head">
                <span className="yds-market-state-timeline__label">{seg.label}</span>
                <span className="yds-market-state-timeline__duration">{seg.durationLabel}</span>
              </div>
              <p className="yds-market-state-timeline__dates">{seg.dateRangeLabel}</p>
              {seg.isCurrent ? (
                <span className="yds-market-state-timeline__now">현재</span>
              ) : null}
              {seg.tooltipLines.length > 0 ? (
                <div className="yds-market-state-timeline__tooltip" role="tooltip">
                  {seg.tooltipLines.map((line) => (
                    <span key={line} className="yds-market-state-timeline__tooltip-line">
                      {line}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
