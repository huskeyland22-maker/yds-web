import { useMemo } from "react"
import YdsMarketStatePrimaryPanel from "./YdsMarketStatePrimaryPanel.jsx"
import YdsMarketPanicSecondaryPanel from "./YdsMarketPanicSecondaryPanel.jsx"

/**
 * V8 Hero — 시장 상태(메인) + 패닉 강도(보조)
 * @param {{ panicData?: object | null; historyRows?: object[]; className?: string }} props
 */
export default function YdsMarketScoreHero({
  panicData = null,
  historyRows = [],
  className = "",
}) {
  return (
    <section
      className={[
        "yds-market-score-hero",
        "yds-market-hero--desk",
        "yds-market-score-hero--v7",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="시장 상태 · 패닉 강도"
    >
      <div className="yds-market-score-hero__header yds-market-desk__slot yds-market-desk__slot--scores-meta">
        <p className="yds-market-score-hero__philosophy">
          시장 상태 = 전략 · 패닉 강도 = 매수 강도
        </p>
      </div>

      <div className="yds-market-score-hero__stack yds-market-desk__slot yds-market-desk__slot--scores">
        <YdsMarketStatePrimaryPanel embedded panicData={panicData} historyRows={historyRows} />
        <YdsMarketPanicSecondaryPanel embedded panicData={panicData} />
      </div>
    </section>
  )
}
