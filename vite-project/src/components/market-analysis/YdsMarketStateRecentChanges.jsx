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

  const { cycleStrip } = report

  return (
    <section
      className={["yds-market-state-timeline", "yds-market-state-timeline--rich", className]
        .filter(Boolean)
        .join(" ")}
      aria-label={report.title}
    >
      <p className="yds-market-state-timeline__title">{report.title}</p>

      <div className="yds-market-state-cycle-strip" aria-label="시장 사이클">
        <div className="yds-market-state-cycle-strip__track">
          {cycleStrip.stages.map((stage, index) => {
            const isCurrent = stage.id === cycleStrip.currentId
            return (
              <div
                key={stage.id}
                className={[
                  "yds-market-state-cycle-strip__step",
                  isCurrent ? "yds-market-state-cycle-strip__step--current" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ "--cycle-color": stage.color }}
              >
                {index > 0 ? (
                  <span className="yds-market-state-cycle-strip__dash" aria-hidden>
                    ─
                  </span>
                ) : null}
                <span className="yds-market-state-cycle-strip__label">{stage.label}</span>
                {isCurrent ? (
                  <span className="yds-market-state-cycle-strip__marker">▲ 현재</span>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

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
            style={{ "--state-color": seg.color }}
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

            <article className="yds-market-state-timeline__card">
              <div className="yds-market-state-timeline__head">
                <span className="yds-market-state-timeline__label">{seg.label}</span>
                <span className="yds-market-state-timeline__duration">{seg.durationLabel}</span>
              </div>

              <p className="yds-market-state-timeline__dates">{seg.dateRangeLabel}</p>

              {seg.scoreRows.length ? (
                <dl className="yds-market-state-timeline__scores">
                  {seg.scoreRows.map((row) => (
                    <div key={row.key}>
                      <dt>{row.label}</dt>
                      <dd className="font-mono tabular-nums">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {seg.investmentActionLines.length ? (
                <div className="yds-market-state-timeline__action">
                  <p className="yds-market-state-timeline__action-title">투자 행동</p>
                  {seg.investmentActionLines.map((line) => (
                    <p key={line} className="yds-market-state-timeline__action-line">
                      {line}
                    </p>
                  ))}
                </div>
              ) : null}
            </article>
          </li>
        ))}
      </ol>
    </section>
  )
}
