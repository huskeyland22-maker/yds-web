import YdsLiquidityLaneCard from "./YdsLiquidityLaneCard.jsx"

/**
 * @param {{
 *   lane: import("../../market-os/liquidityDualEngine.js").LiquidityLaneCard
 *   loading?: boolean
 *   className?: string
 *   collapsibleOnMobile?: boolean
 * }} props
 */
export default function YdsDashboardLiquidityLaneDesk({
  lane,
  loading = false,
  className = "",
  collapsibleOnMobile = true,
}) {
  const score = lane.score
  const summaryLabel = score != null ? `${score}점 · ${lane.band.label}` : loading ? "수집 중" : "—"

  if (!collapsibleOnMobile) {
    return (
      <section className={["yds-liquidity-lane-desk", className].filter(Boolean).join(" ")}>
        <YdsLiquidityLaneCard lane={lane} loading={loading} />
      </section>
    )
  }

  return (
    <details
      className={[
        "yds-liquidity-lane-desk",
        "yds-liquidity-lane-desk--collapsible-mobile",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <summary className="yds-liquidity-lane-desk__summary">
        <span className="yds-liquidity-lane-desk__summary-title">{lane.title}</span>
        <span className="yds-liquidity-lane-desk__summary-meta font-mono tabular-nums">
          {summaryLabel}
        </span>
      </summary>
      <div className="yds-liquidity-lane-desk__body">
        <YdsLiquidityLaneCard lane={lane} loading={loading} />
      </div>
    </details>
  )
}
