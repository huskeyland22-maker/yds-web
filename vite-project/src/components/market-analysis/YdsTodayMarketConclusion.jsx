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
export default function YdsTodayMarketConclusion({
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

  if (!report.visible) return null

  const [headline, ...restLines] = report.lines

  return (
    <section
      className={[
        "yds-today-conclusion",
        `yds-today-conclusion--${report.signalId}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={report.title}
    >
      <p className="yds-today-conclusion__title">{report.title}</p>

      <div className="yds-today-conclusion__body">
        {headline ? (
          <p className="yds-today-conclusion__headline">
            <span className="yds-today-conclusion__signal" aria-hidden>
              {report.signalEmoji}
            </span>{" "}
            {headline}
          </p>
        ) : null}
        {restLines.map((line) => (
          <p key={line} className="yds-today-conclusion__line">
            {line}
          </p>
        ))}
      </div>

      {report.actions.length > 0 ? (
        <div className="yds-today-conclusion__actions">
          <p className="yds-today-conclusion__actions-label">추천 행동</p>
          <ul className="yds-today-conclusion__action-list">
            {report.actions.map((action) => (
              <li key={action} className="yds-today-conclusion__action">
                <span className="yds-today-conclusion__check" aria-hidden>
                  ✓
                </span>
                {action}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
