import YdsDeskCard from "./YdsDeskCard.jsx"

/**
 * @param {{
 *   report: import("../../market-os/liquidityDualEngine.js").DualLiquidityReport | null
 *   className?: string
 * }} props
 */
export default function YdsDashboardLiquiditySynthesis({ report, className = "" }) {
  if (!report?.visible || !report.synthesis) return null

  return (
    <YdsDeskCard
      title="유동성 종합 해석"
      titleId="desk-liquidity-synthesis-title"
      className={className}
    >
      <div className="yds-liquidity-summary yds-liquidity-summary--solo">
        <p className="yds-liquidity-summary__headline">{report.synthesis.headline}</p>
        <ul className="yds-liquidity-summary__lines">
          {report.synthesis.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </YdsDeskCard>
  )
}
