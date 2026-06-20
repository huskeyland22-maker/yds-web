import { useMemo } from "react"
import YdsDataSourceBadge from "./YdsDataSourceBadge.jsx"
import YdsMarketStatePrimaryPanel from "./YdsMarketStatePrimaryPanel.jsx"
import YdsMarketPanicSecondaryPanel from "./YdsMarketPanicSecondaryPanel.jsx"
import YdsInvestmentCalendarStrip from "./YdsInvestmentCalendarStrip.jsx"
import { buildWeekEventStrip } from "../../content/ydsInvestmentCalendarEngine.js"
import { useYdsMarketContext } from "../../hooks/useYdsMarketContext.js"

/**
 * V8 Hero — 시장 상태(메인) + 패닉 강도(보조)
 * @param {{ panicData?: object | null; historyRows?: object[]; className?: string }} props
 */
export default function YdsMarketScoreHero({
  panicData = null,
  historyRows = [],
  className = "",
}) {
  const marketContext = useYdsMarketContext()
  const calendarStrip = useMemo(
    () => buildWeekEventStrip(marketContext?.ready ? marketContext : null, 5),
    [marketContext],
  )

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
        <YdsDataSourceBadge />
      </div>

      <div className="yds-market-score-hero__stack yds-market-desk__slot yds-market-desk__slot--scores">
        <YdsMarketStatePrimaryPanel embedded panicData={panicData} historyRows={historyRows} />
        <YdsMarketPanicSecondaryPanel embedded panicData={panicData} />
      </div>

      <YdsInvestmentCalendarStrip report={calendarStrip} />
    </section>
  )
}
