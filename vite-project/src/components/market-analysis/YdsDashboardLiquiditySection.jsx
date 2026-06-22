import YdsDeskCard from "./YdsDeskCard.jsx"
import YdsLiquidityLaneCard from "./YdsLiquidityLaneCard.jsx"

/**
 * @param {{
 *   report: import("../../market-os/liquidityDualEngine.js").DualLiquidityReport | null
 *   loading?: boolean
 * }} props
 */
export default function YdsDashboardLiquiditySection({ report, loading = false }) {
  if (!report?.visible) return null

  return (
    <YdsDeskCard title="유동성 환경" titleId="desk-liquidity-title">
      <div className="yds-liquidity-dual">
        <YdsLiquidityLaneCard lane={report.market} loading={loading} />
        <YdsLiquidityLaneCard lane={report.policy} loading={loading} />
      </div>

      {report.synthesis ? (
        <div className="yds-liquidity-summary" aria-labelledby="desk-liquidity-summary-label">
          <h3 id="desk-liquidity-summary-label" className="yds-liquidity-summary__label">
            유동성 종합 해석
          </h3>
          <p className="yds-liquidity-summary__headline">{report.synthesis.headline}</p>
          <ul className="yds-liquidity-summary__lines">
            {report.synthesis.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </YdsDeskCard>
  )
}
