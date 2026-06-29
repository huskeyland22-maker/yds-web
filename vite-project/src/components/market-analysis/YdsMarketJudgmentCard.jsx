import { useMemo } from "react"
import { buildMarketJudgmentDashboardReport } from "../../content/ydsMarketJudgmentDashboardEngine.js"

/**
 * @param {{
 *   panicData?: object | null
 *   cycleFlow?: import("../../content/ydsMarketCycleFlow.js").MarketCycleFlowReport | null
 *   dualLiquidity?: import("../../market-os/liquidityDualEngine.js").DualLiquidityReport | null
 *   etfContext?: object | null
 *   className?: string
 * }} props
 */
export default function YdsMarketJudgmentCard({
  panicData = null,
  cycleFlow = null,
  dualLiquidity = null,
  etfContext = null,
  className = "",
}) {
  const report = useMemo(
    () => buildMarketJudgmentDashboardReport({ panicData, cycleFlow, dualLiquidity, etfContext }),
    [panicData, cycleFlow, dualLiquidity, etfContext],
  )

  if (!report.visible) return null

  return (
    <article
      className={["yds-desk-card", "yds-market-judgment-card", className].filter(Boolean).join(" ")}
      aria-label={report.title}
    >
      <h3 className="yds-desk-card__title">{report.title}</h3>

      <div className="yds-market-judgment-card__stage">
        <span className="yds-market-judgment-card__stage-label">현재 단계</span>
        <strong className="yds-market-judgment-card__stage-value">{report.currentStage}</strong>
      </div>

      {report.strongSignals.length ? (
        <div className="yds-market-judgment-card__block">
          <p className="yds-market-judgment-card__block-title">
            강세 요인 {report.strongSignals.length}
          </p>
          <ul className="yds-market-judgment-card__chips">
            {report.strongSignals.map((item) => (
              <li key={item} className="yds-market-judgment-card__chip yds-market-judgment-card__chip--up">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.riskFactors.length ? (
        <div className="yds-market-judgment-card__block">
          <p className="yds-market-judgment-card__block-title">
            위험 요인 {report.riskFactors.length}
          </p>
          <ul className="yds-market-judgment-card__chips">
            {report.riskFactors.map((item) => (
              <li key={item} className="yds-market-judgment-card__chip yds-market-judgment-card__chip--down">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.keyRationale.length ? (
        <div className="yds-market-judgment-card__block">
          <p className="yds-market-judgment-card__block-title">핵심 근거</p>
          <ul className="yds-market-judgment-card__checks">
            {report.keyRationale.map((item) => (
              <li key={item}>✓ {item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.warnings.length ? (
        <div className="yds-market-judgment-card__block">
          <p className="yds-market-judgment-card__block-title">주의사항</p>
          <ul className="yds-market-judgment-card__warns">
            {report.warnings.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  )
}
