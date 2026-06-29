import { useMemo } from "react"
import { buildDashboardActionGuideReport } from "../../content/ydsDashboardActionGuide.js"
import { buildTodayActionDashboardReport } from "../../content/ydsMarketJudgmentDashboardEngine.js"

/**
 * @param {{
 *   panicData?: object | null
 *   historyRows?: object[]
 *   cycleFlow?: import("../../content/ydsMarketCycleFlow.js").MarketCycleFlowReport | null
 *   dualLiquidity?: import("../../market-os/liquidityDualEngine.js").DualLiquidityReport | null
 *   etfContext?: object | null
 *   className?: string
 * }} props
 */
export default function YdsTodayActionCard({
  panicData = null,
  historyRows = [],
  cycleFlow = null,
  dualLiquidity = null,
  etfContext = null,
  className = "",
}) {
  const report = useMemo(() => {
    const guide = buildDashboardActionGuideReport(
      panicData,
      historyRows,
      dualLiquidity,
      cycleFlow,
      {
        spyPrices: etfContext?.spyPrices,
        qqqPrices: etfContext?.qqqPrices,
        asOfDate: etfContext?.asOfDate ?? null,
      },
    )
    return buildTodayActionDashboardReport(guide)
  }, [panicData, historyRows, dualLiquidity, cycleFlow, etfContext])

  if (!report.visible) return null

  return (
    <article
      className={["yds-desk-card", "yds-today-action-card", className].filter(Boolean).join(" ")}
      aria-label={report.title}
    >
      <h3 className="yds-desk-card__title">{report.title}</h3>

      <div className="yds-today-action-card__block">
        <p className="yds-today-action-card__block-title">추천 전략</p>
        <ul className="yds-today-action-card__list">
          {report.strategies.map((action) => (
            <li key={action}>✓ {action}</li>
          ))}
        </ul>
      </div>

      {report.cashPct != null && report.stockPct != null ? (
        <div className="yds-today-action-card__block">
          <p className="yds-today-action-card__block-title">추천 비중</p>
          <dl className="yds-today-action-card__alloc">
            <div>
              <dt>현금</dt>
              <dd className="font-mono tabular-nums">{report.cashPct}%</dd>
            </div>
            <div>
              <dt>주식</dt>
              <dd className="font-mono tabular-nums">{report.stockPct}%</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </article>
  )
}
