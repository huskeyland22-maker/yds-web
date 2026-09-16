import { useMemo } from "react"
import {
  buildMarketTrendView,
  MARKET_TREND_WINDOW_DAYS,
} from "../../content/ydsMarketTrendSeries.js"
import YdsMarketTrendChart from "./YdsMarketTrendChart.jsx"

/**
 * Panic Index 추이만 표시 (시장 상태 추이 UI 제거)
 * @param {{ historyRows?: object[]; className?: string }} props
 */
export default function YdsMarketTrendSection({ historyRows = [], className = "" }) {
  const view = useMemo(() => buildMarketTrendView(historyRows), [historyRows])

  const hasData = view.panic.chartData.length > 0
  if (!hasData) return null

  return (
    <section
      className={["yds-market-trend", "yds-market-trend--panic-only", className]
        .filter(Boolean)
        .join(" ")}
      aria-label={`최근 ${MARKET_TREND_WINDOW_DAYS}일 Panic Index 추이`}
    >
      <h3 className="yds-market-trend__heading">PANIC INDEX HISTORY</h3>
      <p className="yds-market-trend__sub">
        최근 {MARKET_TREND_WINDOW_DAYS}일 · 현재 판단을 보조하는 참고 추이
      </p>
      <div className="yds-market-trend__panel yds-market-trend__panel--solo">
        <YdsMarketTrendChart
          title="Panic Index"
          chartData={view.panic.chartData}
          dataKey="panicIntensity"
          current={view.panic.current}
          currentMeta={view.panic.currentMeta}
          chartKind="panic"
        />
      </div>
    </section>
  )
}
