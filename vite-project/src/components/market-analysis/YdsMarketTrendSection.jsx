import { useMemo } from "react"
import {
  buildMarketTrendView,
  MARKET_TREND_WINDOW_DAYS,
} from "../../content/ydsMarketTrendSeries.js"
import YdsMarketTrendChart from "./YdsMarketTrendChart.jsx"

/**
 * 시장 상태 · 패닉 강도 30일 추이
 * @param {{ historyRows?: object[]; className?: string; panel?: 'both' | 'market' | 'panic' }} props
 */
export default function YdsMarketTrendSection({
  historyRows = [],
  className = "",
  panel = "both",
}) {
  const view = useMemo(() => buildMarketTrendView(historyRows), [historyRows])

  const showMarket = panel === "both" || panel === "market"
  const showPanic = panel === "both" || panel === "panic"
  const hasMarket = showMarket && view.market.chartData.length > 0
  const hasPanic = showPanic && view.panic.chartData.length > 0
  if (!hasMarket && !hasPanic) return null

  const singlePanel = panel !== "both"

  return (
    <section
      className={[
        "yds-market-trend",
        singlePanel ? "yds-market-trend--single" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={`최근 ${MARKET_TREND_WINDOW_DAYS}일 시장 추이`}
    >
      <div className={singlePanel ? "yds-market-trend__single" : "yds-market-trend__grid"}>
        {hasMarket ? (
          <div className="yds-market-trend__panel">
            <YdsMarketTrendChart
              title="시장 상태 추이"
              chartData={view.market.chartData}
              dataKey="marketStateScore"
              current={view.market.current}
              currentMeta={view.market.currentMeta}
            />
          </div>
        ) : null}

        {hasPanic ? (
          <div className="yds-market-trend__panel">
            <YdsMarketTrendChart
              title="패닉 강도 추이"
              chartData={view.panic.chartData}
              dataKey="panicIntensity"
              current={view.panic.current}
              currentMeta={view.panic.currentMeta}
              chartKind="panic"
            />
          </div>
        ) : null}
      </div>
    </section>
  )
}
