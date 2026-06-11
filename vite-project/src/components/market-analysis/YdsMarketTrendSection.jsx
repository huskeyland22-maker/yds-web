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
          {view.market.changes.length > 0 ? (
            <div className="yds-market-trend__changes">
              <p className="yds-market-trend__changes-label">최근 주요 변화</p>
              <ul className="yds-market-trend__changes-list">
                {view.market.changes.map((item) => (
                  <li key={`${item.date}:${item.title}`} className="yds-market-trend__changes-item">
                    <span className="yds-market-trend__changes-date font-mono tabular-nums">
                      {item.dateLabel}
                    </span>
                    <span className="yds-market-trend__changes-title">{item.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="yds-market-trend__panel">
          <YdsMarketTrendChart
            title="패닉 강도 추이"
            chartData={view.panic.chartData}
            dataKey="panicIntensity"
            current={view.panic.current}
            currentMeta={view.panic.currentMeta}
          />
          {view.panic.changes.length > 0 ? (
            <div className="yds-market-trend__changes">
              <p className="yds-market-trend__changes-label">최근 주요 변화</p>
              <ul className="yds-market-trend__changes-list">
                {view.panic.changes.map((item) => (
                  <li key={`${item.date}:${item.title}`} className="yds-market-trend__changes-item">
                    <span className="yds-market-trend__changes-date font-mono tabular-nums">
                      {item.dateLabel}
                    </span>
                    <span className="yds-market-trend__changes-title">{item.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
