/**
 * @param {{ rows?: number; className?: string }} props
 */
export default function YdsStockPickHubSkeleton({ rows = 5, className = "" }) {
  return (
    <div
      className={["yds-spick-skeleton", className].filter(Boolean).join(" ")}
      aria-hidden
    >
      <div className="yds-spick-skeleton__dash" />
      <div className="yds-spick-skeleton__row" />
      <div className="yds-spick-skeleton__cards">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="yds-spick-skeleton__card" />
        ))}
      </div>
      <div className="yds-spick-skeleton__table" />
    </div>
  )
}
