import { useMemo } from "react"
import YdsDataSourceBadge from "./YdsDataSourceBadge.jsx"
import YdsMarketStatePrimaryPanel from "./YdsMarketStatePrimaryPanel.jsx"
import YdsMarketPanicSecondaryPanel from "./YdsMarketPanicSecondaryPanel.jsx"
import YdsMarketRecommendStrip from "./YdsMarketRecommendStrip.jsx"

/**
 * Hero — 시장 상태(메인) → 현재 전략 → 패닉 강도(보조) → 추천 종목
 * @param {{ panicData?: object | null; historyRows?: object[]; className?: string; showRecommend?: boolean }} props
 */
export default function YdsMarketScoreHero({
  panicData = null,
  historyRows: _historyRows = [],
  className = "",
  showRecommend = true,
}) {
  return (
    <section
      className={["yds-market-score-hero", "yds-market-hero--desk", "yds-market-score-hero--state-first", className]
        .filter(Boolean)
        .join(" ")}
      aria-label="시장 상태 · 패닉 강도"
    >
      <div className="yds-market-score-hero__header yds-market-desk__slot yds-market-desk__slot--scores-meta">
        <p className="yds-market-score-hero__philosophy">
          시장 상태 우선 · 패닉 강도는 매수 보조
        </p>
        <YdsDataSourceBadge />
      </div>

      <div className="yds-market-score-hero__stack yds-market-desk__slot yds-market-desk__slot--scores">
        <YdsMarketStatePrimaryPanel embedded panicData={panicData} />
        <YdsMarketPanicSecondaryPanel embedded panicData={panicData} />
      </div>

      {showRecommend ? (
        <YdsMarketRecommendStrip className="yds-market-desk__slot yds-market-desk__slot--recommend" />
      ) : null}
    </section>
  )
}
