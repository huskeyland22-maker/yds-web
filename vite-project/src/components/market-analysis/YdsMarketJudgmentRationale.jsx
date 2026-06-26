import { useMemo } from "react"
import { buildMarketJudgmentRationale } from "../../content/ydsMarketJudgmentRationale.js"

/**
 * @param {{
 *   panicData?: object | null
 *   cycleFlow?: import("../../content/ydsMarketCycleFlow.js").MarketCycleFlowReport | null
 *   dualLiquidity?: import("../../market-os/liquidityDualEngine.js").DualLiquidityReport | null
 *   etfContext?: object | null
 *   className?: string
 * }} props
 */
export default function YdsMarketJudgmentRationale({
  panicData = null,
  cycleFlow = null,
  dualLiquidity = null,
  etfContext = null,
  className = "",
}) {
  const report = useMemo(
    () =>
      buildMarketJudgmentRationale({
        panicData,
        cycleFlow,
        dualLiquidity,
        etfContext,
      }),
    [panicData, cycleFlow, dualLiquidity, etfContext],
  )

  if (!report.visible) return null

  return (
    <section
      className={["yds-market-judgment", className].filter(Boolean).join(" ")}
      aria-label="시장 판단 근거"
    >
      <p className="yds-market-judgment__title">시장 판단 근거</p>

      <div className="yds-market-judgment__counts">
        <span className="yds-market-judgment__count yds-market-judgment__count--positive">
          긍정 {report.positiveCount}
        </span>
        <span className="yds-market-judgment__count yds-market-judgment__count--negative">
          부정 {report.negativeCount}
        </span>
      </div>

      <p className="yds-market-judgment__stage">{report.unifiedLabel}</p>
      <p className="yds-market-judgment__conclusion">{report.conclusion}</p>

      <ul className="yds-market-judgment__list">
        {report.factors.map((factor) => (
          <li
            key={factor.id}
            className={[
              "yds-market-judgment__item",
              `yds-market-judgment__item--${factor.tone}`,
            ].join(" ")}
          >
            <span className="yds-market-judgment__icon" aria-hidden>
              {factor.icon}
            </span>
            {factor.text}
          </li>
        ))}
      </ul>
    </section>
  )
}
