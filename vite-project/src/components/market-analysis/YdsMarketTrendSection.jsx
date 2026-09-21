import YdsPanicSpxValidationChart from "./YdsPanicSpxValidationChart.jsx"

/**
 * Panic Index History
 * @param {{ historyRows?: object[]; className?: string }} props
 */
export default function YdsMarketTrendSection({ historyRows: _historyRows = [], className = "" }) {
  return (
    <section
      className={["yds-market-trend", "yds-market-trend--panic-spx-val", className]
        .filter(Boolean)
        .join(" ")}
      aria-label="Panic Index History"
    >
      <h3 className="yds-market-trend__heading">PANIC INDEX HISTORY</h3>
      <p className="yds-market-trend__sub">
        Panic Index와 S&amp;P500 · 기준선 50 / 60 / 70
      </p>
      <div className="yds-market-trend__panel yds-market-trend__panel--solo yds-market-trend__panel--featured">
        <YdsPanicSpxValidationChart />
      </div>
    </section>
  )
}
