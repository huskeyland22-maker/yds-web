import { useMemo } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { YDS_SCORE_ZONE_STEPS } from "../../content/ydsMarketTrendSeries.js"

const CHART_HEIGHT = 210
const CHART_MARGIN = { top: 18, right: 8, left: 4, bottom: 22 }
const ZONE_FILL_OPACITY = 0.09

/** @param {boolean} active @param {object[]} payload */
function TrendTooltip({ active, payload, title }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  const value = payload[0]?.value
  if (!row) return null
  return (
    <div className="yds-market-trend-chart__tooltip">
      <p className="yds-market-trend-chart__tooltip-date">{row.axisLabel ?? row.date}</p>
      <p className="yds-market-trend-chart__tooltip-value font-mono tabular-nums">
        {value}
        <span className="yds-market-trend-chart__tooltip-label">{title}</span>
      </p>
    </div>
  )
}

/** @param {import("recharts").DotProps & { index?: number; dataLength?: number; color?: string }} props */
function CurrentPointDot({ cx, cy, index, dataLength, color }) {
  if (cx == null || cy == null || index == null || dataLength == null) return null
  if (index !== dataLength - 1) return null
  const stroke = color ?? "#e2e8f0"
  return (
    <g className="yds-market-trend-chart__current-dot">
      <circle cx={cx} cy={cy} r={11} fill={stroke} fillOpacity={0.16} stroke="none" />
      <circle cx={cx} cy={cy} r={5.5} fill={stroke} stroke="#0b0e14" strokeWidth={1.75} />
    </g>
  )
}

/**
 * 0~100 점수 추이 라인 차트 (시장 상태 · 패닉 강도)
 * @param {{
 *   title: string
 *   chartData: object[]
 *   dataKey?: string
 *   current?: number | null
 *   currentMeta?: { score: number; color: string; label: string } | null
 *   stroke?: string
 *   emptyMessage?: string
 * }} props
 */
export default function YdsMarketTrendChart({
  title,
  chartData = [],
  dataKey = "value",
  current = null,
  currentMeta = null,
  stroke,
  emptyMessage = "최근 30일 데이터 없음",
}) {
  const lineStroke = stroke ?? currentMeta?.color ?? "#94a3b8"
  const pointCount = chartData.length
  const curveType = pointCount >= 3 ? "monotone" : "linear"

  const zoneBands = useMemo(
    () =>
      YDS_SCORE_ZONE_STEPS.map((zone, idx) => ({
        y1: zone.min,
        y2: idx === YDS_SCORE_ZONE_STEPS.length - 1 ? 100 : zone.max,
        color: zone.color,
      })),
    [],
  )

  if (pointCount < 1) {
    return (
      <article className="yds-market-trend-chart">
        <header className="yds-market-trend-chart__head">
          <h3 className="yds-market-trend-chart__title">{title}</h3>
        </header>
        <div className="yds-market-trend-chart__empty">{emptyMessage}</div>
      </article>
    )
  }

  const displayScore = currentMeta?.score ?? current

  return (
    <article className="yds-market-trend-chart">
      <header className="yds-market-trend-chart__head">
        <h3 className="yds-market-trend-chart__title">{title}</h3>
        {displayScore != null ? (
          <div
            className="yds-market-trend-chart__badge font-mono tabular-nums"
            style={{
              "--trend-badge-color": currentMeta?.color ?? lineStroke,
            }}
            aria-label={`현재 ${displayScore}`}
          >
            <span className="yds-market-trend-chart__badge-score">{displayScore}</span>
            {currentMeta?.label ? (
              <span className="yds-market-trend-chart__badge-label">{currentMeta.label}</span>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="yds-market-trend-chart__plot">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart data={chartData} margin={CHART_MARGIN}>
            {zoneBands.map((band) => (
              <ReferenceArea
                key={`${band.y1}-${band.y2}`}
                y1={band.y1}
                y2={band.y2}
                fill={band.color}
                fillOpacity={ZONE_FILL_OPACITY}
                strokeOpacity={0}
                ifOverflow="hidden"
              />
            ))}
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="axisLabel"
              stroke="#64748b"
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(148,163,184,0.2)" }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              domain={[0, 100]}
              allowDataOverflow
              tickCount={6}
              tickFormatter={(v) => String(Math.round(v))}
              stroke="#64748b"
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(148,163,184,0.2)" }}
              width={28}
            />
            <Tooltip
              content={(props) => <TrendTooltip {...props} title={title} />}
              cursor={{ stroke: "rgba(148,163,184,0.3)", strokeWidth: 1 }}
            />
            <Line
              type={curveType}
              dataKey={dataKey}
              stroke={lineStroke}
              strokeWidth={pointCount === 1 ? 0 : 2.5}
              dot={(dotProps) => (
                <CurrentPointDot
                  {...dotProps}
                  dataLength={pointCount}
                  color={lineStroke}
                />
              )}
              activeDot={{
                r: 5,
                strokeWidth: 2,
                fill: lineStroke,
                stroke: "#0b0e14",
              }}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </article>
  )
}
