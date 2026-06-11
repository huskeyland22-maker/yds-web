import YdsDataSourceBadge from "./YdsDataSourceBadge.jsx"
import YdsMarketPanicCard from "./YdsMarketPanicCard.jsx"
import YdsMarketStateCard from "./YdsMarketStateCard.jsx"

/**
 * Hero — 시장 상태 · 패닉 강도 (행동 우선 판단)
 * @param {{ panicData?: object | null; historyRows?: object[]; className?: string }} props
 */
export default function YdsMarketScoreHero({
  panicData = null,
  historyRows = [],
  className = "",
}) {
  return (
    <section
      className={["yds-market-score-hero", "yds-market-hero--desk", className]
        .filter(Boolean)
        .join(" ")}
      aria-label="시장 상태 · 패닉 강도"
    >
      <div className="yds-market-score-hero__header yds-market-desk__slot yds-market-desk__slot--scores-meta">
        <span className="yds-market-hero__header-spacer" aria-hidden />
        <YdsDataSourceBadge />
      </div>

      <div className="yds-market-score-hero__dual-row yds-market-desk__slot yds-market-desk__slot--scores">
        <YdsMarketStateCard embedded panicData={panicData} historyRows={historyRows} />
        <YdsMarketPanicCard embedded panicData={panicData} historyRows={historyRows} />
      </div>
    </section>
  )
}
