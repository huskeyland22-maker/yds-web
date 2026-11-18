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

  if (!report.visible) {
    return (
      <section
        className={["yds-ai-market-briefing", "yds-ai-market-briefing--empty", className]
          .filter(Boolean)
          .join(" ")}
        aria-label={report.title}
        data-empty="true"
      >
        <p className="yds-ai-market-briefing__empty">
          연결된 시장 지표·가격 구조가 없어 브리핑을 만들지 못했습니다.
        </p>
      </section>
    )
  }

  return (
    <section
      className={["yds-ai-market-briefing", className].filter(Boolean).join(" ")}
      aria-label={report.title}
      data-empty="false"
    >
      <p className="yds-ai-market-briefing__title">{report.title}</p>

      {report.reasons.length ? (
        <ul className="yds-ai-market-briefing__reasons">
          {report.reasons.map((reason) => (
            <li key={reason} className="yds-ai-market-briefing__reason">
              <span className="yds-ai-market-briefing__check" aria-hidden>
                ✔
              </span>
              {reason}
            </li>
          ))}
        </ul>
      ) : null}

      {report.narrative.length ? (
        <div className="yds-ai-market-briefing__narrative">
          {report.narrative.map((line) => (
            <p key={line} className="yds-ai-market-briefing__line">
              {line}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  )
}
