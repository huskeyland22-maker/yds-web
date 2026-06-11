import { useMemo } from "react"
import {
  buildMarketTrendView,
  MARKET_TREND_WINDOW_DAYS,
} from "../../content/ydsMarketTrendSeries.js"
import YdsMarketTrendChart from "./YdsMarketTrendChart.jsx"

/**
 * 시장 상태 · 패닉 강도 30일 추이
 * @param {{ historyRows?: object[]; className?: string }} props
 */
export default function YdsMarketTrendSection({ historyRows = [], className = "" }) {
  const view = useMemo(() => buildMarketTrendView(historyRows), [historyRows])

  const hasData = view.market.chartData.length > 0 || view.panic.chartData.length > 0
  if (!hasData) return null

  return (
    <section
      className={["yds-market-trend", className].filter(Boolean).join(" ")}
      aria-label={`최근 ${MARKET_TREND_WINDOW_DAYS}일 시장 추이`}
    >
      <div className="yds-market-trend__grid">
        <div className="yds-market-trend__panel">
          <YdsMarketTrendChart
            title="시장 상태 추이"
            chartData={view.market.chartData}
            dataKey="marketStateScore"
            current={view.market.current}
            currentMeta={view.market.currentMeta}
          />
        </div>

        <div className="yds-market-trend__panel">
          <YdsMarketTrendChart
            title="패닉 강도 추이"
            chartData={view.panic.chartData}
            dataKey="panicIntensity"
            current={view.panic.current}
            currentMeta={view.panic.currentMeta}
          />
        </div>
      </div>
    </section>
  )
}
