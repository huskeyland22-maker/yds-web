import { useMemo } from "react"
import { buildAiMarketBriefing } from "../../content/ydsAiMarketBriefing.js"

/**
 * @param {{
 *   panicData?: object | null
 *   cycleFlow?: import("../../content/ydsMarketCycleFlow.js").MarketCycleFlowReport | null
 *   dualLiquidity?: import("../../market-os/liquidityDualEngine.js").DualLiquidityReport | null
 *   etfContext?: { qqqPrices?: Record<string, number>; spyPrices?: Record<string, number>; asOfDate?: string | null } | null
 *   className?: string
 * }} props
 */
export default function YdsAiMarketBriefing({
  panicData = null,
  cycleFlow = null,
  dualLiquidity = null,
  etfContext = null,
  className = "",
}) {
  const report = useMemo(
    () =>
      buildAiMarketBriefing({
        panicData,
        cycleFlow,
        dualLiquidity,
        priceContext: {
          spyPrices: etfContext?.spyPrices,
          qqqPrices: etfContext?.qqqPrices,
          asOfDate: etfContext?.asOfDate ?? null,
        },
      }),
    [panicData, cycleFlow, dualLiquidity, etfContext],
  )

  if (!report.visible) return null

  return (
    <section
      className={["yds-ai-market-briefing", className].filter(Boolean).join(" ")}
      aria-label={report.title}
    >
      <p className="yds-ai-market-briefing__title">{report.title}</p>
      <div className="yds-ai-market-briefing__body">
        {report.lines.map((line) => (
          <p key={line} className="yds-ai-market-briefing__line">
            {line}
          </p>
        ))}
      </div>
    </section>
  )
}
