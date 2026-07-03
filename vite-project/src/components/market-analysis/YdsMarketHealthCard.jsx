import { useMemo } from "react"
import { buildMarketHealthReport } from "../../content/ydsMarketHealthEngine.js"

/**
 * 시장 건강도 — 컨디션 종합 체크
 * @param {{
 *   panicData?: object | null
 *   historyRows?: object[]
 *   cycleFlow?: import("../../content/ydsMarketCycleFlow.js").MarketCycleFlowReport | null
 *   dualLiquidity?: import("../../market-os/liquidityDualEngine.js").DualLiquidityReport | null
 *   etfContext?: { qqqPrices?: Record<string, number>; spyPrices?: Record<string, number>; asOfDate?: string | null } | null
 *   className?: string
 * }} props
 */
export default function YdsMarketHealthCard({
  panicData = null,
  historyRows = [],
  cycleFlow = null,
  dualLiquidity = null,
  etfContext = null,
  className = "",
}) {
  const report = useMemo(
    () =>
      buildMarketHealthReport({
        panicData,
        historyRows,
        dualLiquidity,
        cycleFlow,
        etfContext,
      }),
    [panicData, historyRows, dualLiquidity, cycleFlow, etfContext],
  )

  if (!report.visible) return null

  return (
    <section
      className={["yds-market-health", className].filter(Boolean).join(" ")}
      aria-label={`${report.title} (${report.subtitle})`}
    >
      <div className="yds-market-health__head">
        <p className="yds-market-health__title">{report.title}</p>
        <p className="yds-market-health__subtitle">{report.subtitle}</p>
      </div>

      <ul className="yds-market-health__list">
        {report.items.map((item) => (
          <li key={item.id} className="yds-market-health__row">
            <span className="yds-market-health__signal" aria-hidden>
              {item.gradeEmoji}
            </span>
            <span className="yds-market-health__label">{item.label}</span>
            <span className={`yds-market-health__grade yds-market-health__grade--${item.gradeId}`}>
              {item.gradeLabel}
            </span>
          </li>
        ))}
      </ul>

      {report.summary ? (
        <p className="yds-market-health__summary">{report.summary}</p>
      ) : null}
    </section>
  )
}
