import YdsPanicSpxValidationChart from "./YdsPanicSpxValidationChart.jsx"

/**
 * Panic Index History — 2023~현재 Panic V2 × S&P500 장기 검증
 * (시장 소스 재계산 V2 · 현재 Panic 카드 / Fear Scale 비변경)
 * @param {{ historyRows?: object[]; className?: string }} props
 */
export default function YdsMarketTrendSection({ historyRows: _historyRows = [], className = "" }) {
  return (
    <section
      className={["yds-market-trend", "yds-market-trend--panic-spx-val", className]
        .filter(Boolean)
        .join(" ")}
      aria-label="Panic Index × S&P500 장기 검증"
    >
      <h3 className="yds-market-trend__heading">PANIC INDEX HISTORY</h3>
      <p className="yds-market-trend__sub">
        2023–현재 · Panic V2와 S&P500을 같은 시간축에서 비교 · 기준선 50 / 60 / 70
      </p>
      <div className="yds-market-trend__panel yds-market-trend__panel--solo yds-market-trend__panel--featured">
        <YdsPanicSpxValidationChart />
      </div>
    </section>
  )
}
