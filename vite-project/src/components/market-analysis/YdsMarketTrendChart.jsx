import { useId, useMemo } from "react"
import {
  Area,
  CartesianGrid,
  Line,
  ComposedChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  buildPanicIntensityLegendView,
  panicIntensityLegendZoneSteps,
} from "../../content/ydsPanicIntensityLegend.js"
import { YDS_SCORE_ZONE_STEPS } from "../../content/ydsMarketTrendSeries.js"
import YdsPanicIntensityLegend from "./YdsPanicIntensityLegend.jsx"
import YdsPanicIntensityInfoTip from "./YdsPanicIntensityInfoTip.jsx"

const CHART_HEIGHT = 236
const CHART_MARGIN = { top: 18, right: 10, left: 4, bottom: 22 }
/** Stage bands stay quieter so the line / current point lead */
const ZONE_FILL_OPACITY = 0.045

/** @param {boolean} active @param {object[]} payload @param {string} title @param {"market" | "panic"} chartKind */
function TrendTooltip({ active, payload, title, chartKind = "market" }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  const value = payload[0]?.value
  if (!row) return null
  const rounded = Math.round(Number(value))
  const panicLegend =
    chartKind === "panic" ? buildPanicIntensityLegendView(rounded) : null

  return (
    <div className="yds-market-trend-chart__tooltip">
      <p className="yds-market-trend-chart__tooltip-date">{row.axisLabel ?? row.date}</p>
      {panicLegend ? (
        <>
          <p className="yds-market-trend-chart__tooltip-value font-mono tabular-nums">
            Panic Index {panicLegend.score}
          </p>
          <p className="yds-market-trend-chart__tooltip-stage">{panicLegend.label}</p>
          {panicLegend.rangeLabel ? (
            <p className="yds-market-trend-chart__tooltip-action font-mono tabular-nums">
              {panicLegend.rangeLabel}
            </p>
          ) : null}
        </>
      ) : (
        <p className="yds-market-trend-chart__tooltip-value font-mono tabular-nums">
          {value}
          <span className="yds-market-trend-chart__tooltip-label">{title}</span>
        </p>
      )}
    </div>
  )
}

/**
 * @param {import("recharts").DotProps & {
 *   index?: number
 *   dataLength?: number
 *   color?: string
 * }} props
 */
function PanicPointDot({ cx, cy, index, dataLength, color }) {
  if (cx == null || cy == null || index == null || dataLength == null) return null
  const stroke = color ?? "#e2e8f0"
  const isCurrent = index === dataLength - 1
  if (isCurrent) {
    return (
      <g className="yds-market-trend-chart__current-dot">
        <circle cx={cx} cy={cy} r={9} fill={stroke} fillOpacity={0.14} stroke="none" />
        <circle
          cx={cx}
          cy={cy}
          r={5.25}
          fill={stroke}
          stroke="#0b0e14"
          strokeWidth={1.75}
        />
      </g>
    )
  }
  return (
    <circle
      className="yds-market-trend-chart__point-dot"
      cx={cx}
      cy={cy}
      r={2.75}
      fill={stroke}
      stroke="#0b0e14"
      strokeWidth={1.25}
      fillOpacity={0.92}
    />
  )
}

/**
 * 0~100 점수 추이 라인 차트 (시장 상태 · Panic Index)
 * @param {{
 *   title: string
 *   chartData: object[]
 *   dataKey?: string
 *   current?: number | null
 *   currentMeta?: { score: number; color: string; label: string; buyStrength?: string; actionLine?: string } | null
 *   stroke?: string
 *   emptyMessage?: string
 *   chartKind?: "market" | "panic"
 * }} props
 */
export default function YdsMarketTrendChart({
  title,
  chartData = [],
  dataKey = "value",
  current = null,
  currentMeta = null,
  stroke,
  emptyMessage = "최근 120일 데이터 없음",
  chartKind = "market",
}) {
  const fillId = useId().replace(/:/g, "")
  const lineStroke = stroke ?? currentMeta?.color ?? "#94a3b8"
  const pointCount = chartData.length
  const curveType = pointCount >= 3 ? "monotone" : "linear"
  const isPanic = chartKind === "panic"

  const zoneBands = useMemo(() => {
    const steps = isPanic ? panicIntensityLegendZoneSteps() : YDS_SCORE_ZONE_STEPS
    return steps.map((zone, idx) => ({
      y1: zone.min,
      y2: idx === steps.length - 1 ? 100 : zone.max,
      color: zone.color,
    }))
  }, [isPanic])

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
  const badgeText =
    displayScore != null && currentMeta?.label
      ? `${displayScore} · ${currentMeta.label}`
      : displayScore != null
        ? String(displayScore)
        : null

  return (
    <article
      className={[
        "yds-market-trend-chart",
        isPanic ? "yds-market-trend-chart--panic" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="yds-market-trend-chart__head">
        <div className="yds-market-trend-chart__title-row">
          <h3 className="yds-market-trend-chart__title">{title}</h3>
          {isPanic ? <YdsPanicIntensityInfoTip /> : null}
        </div>
        {badgeText != null ? (
          <div
            className="yds-market-trend-chart__badge font-mono tabular-nums"
            style={{
              "--trend-badge-color": currentMeta?.color ?? lineStroke,
            }}
            aria-label={`현재 ${badgeText}`}
          >
            <span className="yds-market-trend-chart__badge-score">{badgeText}</span>
            {currentMeta?.rangeLabel ||
            (currentMeta?.min != null && currentMeta?.max != null) ? (
              <span className="yds-market-trend-chart__badge-range font-mono tabular-nums">
                {currentMeta.rangeLabel ?? `${currentMeta.min}–${currentMeta.max}`}
              </span>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="yds-market-trend-chart__plot">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <ComposedChart data={chartData} margin={CHART_MARGIN}>
            <defs>
              <linearGradient id={`panic-area-${fillId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineStroke} stopOpacity={0.2} />
                <stop offset="72%" stopColor={lineStroke} stopOpacity={0.05} />
                <stop offset="100%" stopColor={lineStroke} stopOpacity={0} />
              </linearGradient>
            </defs>
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
            <CartesianGrid stroke="rgba(255,255,255,0.045)" vertical={false} />
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
              ticks={[0, 20, 40, 60, 80, 100]}
              tickFormatter={(v) => String(Math.round(v))}
              stroke="#64748b"
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(148,163,184,0.2)" }}
              width={28}
            />
            <Tooltip
              content={(props) => (
                <TrendTooltip {...props} title={title} chartKind={chartKind} />
              )}
              cursor={{ stroke: "rgba(148,163,184,0.28)", strokeWidth: 1 }}
            />
            {isPanic ? (
              <Area
                type={curveType}
                dataKey={dataKey}
                stroke="none"
                fill={`url(#panic-area-${fillId})`}
                fillOpacity={1}
                connectNulls
                isAnimationActive={false}
                activeDot={false}
                dot={false}
              />
            ) : null}
            <Line
              type={curveType}
              dataKey={dataKey}
              stroke={lineStroke}
              strokeWidth={pointCount === 1 ? 0 : isPanic ? 2.75 : 2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={(dotProps) => (
                <PanicPointDot
                  {...dotProps}
                  dataLength={pointCount}
                  color={lineStroke}
                />
              )}
              activeDot={{
                r: isPanic ? 6.5 : 5,
                strokeWidth: 2,
                fill: lineStroke,
                stroke: "#0b0e14",
              }}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {isPanic ? (
        <YdsPanicIntensityLegend
          score={displayScore}
          compact
          className="yds-market-trend-chart__legend"
        />
      ) : null}
    </article>
  )
}
