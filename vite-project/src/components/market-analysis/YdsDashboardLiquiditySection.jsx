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
    </YdsDeskCard>
  )
}
