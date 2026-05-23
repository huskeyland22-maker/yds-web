import { useMemo } from "react"
import {
  Area,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  INSIGHT_ZONE_FILL_OPACITY,
  metricInsightZoneBands,
  metricZoneBands,
  metricZoneLineYs,
  ZONE_BAND_FILL_OPACITY,
  zoneBandMidpoints,
} from "../utils/panicHistoryZoneLines.js"
import {
  computeHistoryYDomain,
  extractChartValues,
  resolveChartProfile,
  yAxisTickFormatter,
} from "../utils/chartMetricProfiles.js"
import { buildChartDataFromHistory, logHistoryChartDebug } from "../utils/panicHistoryDesk.js"
import { formatMetricValue } from "./macroCycleChartUtils.js"

const CHART_HEIGHT = 340
const CHART_MARGIN = { top: 36, right: 12, left: 8, bottom: 28 }
const ZONE_LABEL_INSET = 14

/** @param {import("recharts").DotProps & { payload?: object }} props */
function InflectionDot(props) {
  const { cx, cy, payload } = props
  if (cx == null || cy == null || !payload?.inflectionLabel) return null
  const color = payload.inflectionColor ?? "#22d3ee"
  return (
    <g className="panic-inflection-dot">
      <circle cx={cx} cy={cy} r={5} fill={color} stroke="#0b0e14" strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={9} fill={color} fillOpacity={0.18} stroke="none" />
    </g>
  )
}

/** @param {boolean} active @param {object[]} payload @param {string} dataLabel */
function HistoryTooltipContent({ active, payload, dataLabel, profileKey }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null
  const value = payload[0]?.value
  return (
    <div className="panic-history-tooltip rounded border border-white/15 bg-[#070a10]/98 px-2 py-1.5 text-[10px] shadow-lg">
      <p className="m-0 text-slate-500">{row.axisLabel ?? row.date}</p>
      <p className="m-0 font-mono font-bold tabular-nums text-slate-50">
        {formatMetricValue(profileKey, value)} <span className="font-normal text-slate-500">{dataLabel}</span>
      </p>
      {row.inflectionLabel ? (
        <p className="m-0 mt-0.5 font-semibold text-cyan-200">{row.inflectionLabel}</p>
      ) : null}
    </div>
  )
}

/**
 * @param {{ bands: { y: number; label: string; color: string }[]; yDomain: [number, number]; height: number }} props
 */
function ZoneYAxisLabels({ bands, yDomain, height }) {
  const [yMin, yMax] = yDomain
  const span = yMax - yMin
  if (!Number.isFinite(span) || span <= 0) return null

  const plotHeight = height - CHART_MARGIN.top - CHART_MARGIN.bottom
  const yToTop = (y) => ((yMax - y) / span) * plotHeight

  return (
    <div
      className="pointer-events-none absolute z-[1]"
      style={{
        top: CHART_MARGIN.top,
        bottom: CHART_MARGIN.bottom,
        right: CHART_MARGIN.right + ZONE_LABEL_INSET,
        width: 76,
      }}
      aria-hidden
    >
      {bands.map((band) => {
        if (band.y < yMin || band.y > yMax) return null
        const top = yToTop(band.y)
        return (
          <span
            key={band.label}
            className="absolute right-0 max-w-[74px] -translate-y-1/2 truncate rounded-full border px-[7px] py-[3px] text-center text-[10px] font-semibold leading-tight text-slate-100/95 backdrop-blur-[2px]"
            style={{
              top,
              borderColor: `${band.color}66`,
              backgroundColor: `${band.color}22`,
              boxShadow: `0 0 10px ${band.color}33`,
            }}
            title={band.label}
          >
            {band.label}
          </span>
        )
      })}
    </div>
  )
}

/**
 * panic_index_history 전용 Recharts 라인 (단일 시리즈)
 * @param {{
 *   rows?: object[]
 *   chartData?: object[] | null
 *   dataKey?: string
 *   metricField?: string
 *   dataLabel?: string
 *   stroke?: string
 *   showZoneBands?: boolean
 *   insightZones?: boolean
 *   height?: number
 *   debug?: boolean
 *   connectNulls?: boolean
 * }} props
 */
export default function PanicHistoryLineChart({
  rows = [],
  chartData: chartDataProp = null,
  dataKey = "vix",
  metricField = "",
  dataLabel = "VIX",
  stroke = "#22d3ee",
  showZoneBands = false,
  insightZones = false,
  height = CHART_HEIGHT,
  debug = false,
  connectNulls = true,
}) {
  const profileKey = metricField || (dataKey === "value" ? "vix" : dataKey)

  const chartData = useMemo(() => {
    if (Array.isArray(chartDataProp) && chartDataProp.length) return chartDataProp
    const data = buildChartDataFromHistory(rows, profileKey)
    if (debug) logHistoryChartDebug(rows, data)
    return data
  }, [rows, profileKey, chartDataProp, debug])

  const profile = useMemo(() => resolveChartProfile(profileKey), [profileKey])

  const useInsightPalette = insightZones || showZoneBands

  const zoneBands = useMemo(() => {
    if (!showZoneBands && !insightZones) return []
    if (insightZones) return metricInsightZoneBands(profileKey)
    return metricZoneBands(profileKey)
  }, [showZoneBands, insightZones, profileKey])

  const zoneFillOpacity = insightZones ? INSIGHT_ZONE_FILL_OPACITY : ZONE_BAND_FILL_OPACITY
  const zoneLineYs = useMemo(
    () => (useInsightPalette ? metricZoneLineYs(profileKey) : []),
    [useInsightPalette, profileKey],
  )

  const yDomain = useMemo(() => {
    const lineKey = dataKey === "value" ? "value" : dataKey
    const values = extractChartValues(chartData, lineKey)
    return computeHistoryYDomain(values, profileKey, { showZoneBands })
  }, [chartData, dataKey, profileKey, showZoneBands])

  const tickFormatter = useMemo(() => yAxisTickFormatter(profile), [profile])

  const zoneLabels = useMemo(() => {
    if (!showZoneBands || !zoneBands.length || !yDomain) return []
    return zoneBandMidpoints(zoneBands)
  }, [showZoneBands, zoneBands, yDomain])

  const areaGradientId = `metricArea-${String(profileKey).replace(/[^a-zA-Z0-9]/g, "")}`
  const lineStrokeWidth = (profile.strokeWidth ?? 3) + (showZoneBands ? 0.5 : 0)
  const pointCount = chartData.length
  const showDots = pointCount > 0 && pointCount < 3
  const curveType = pointCount >= 3 ? "monotone" : "linear"
  const lineDataKey = dataKey === "value" ? "value" : dataKey

  if (chartData.length < 1) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-white/[0.06] bg-black/30 text-[11px] text-slate-500"
        style={{ height, minHeight: height }}
      >
        panic_index_history 데이터 없음
      </div>
    )
  }

  const hasInflectionDots = chartData.some((d) => d.inflectionLabel)

  return (
    <div className="panic-history-lab-chart w-full overflow-visible">
      <div className="relative min-w-0" style={{ height, minHeight: height }}>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData} margin={CHART_MARGIN}>
          {zoneBands.map((band) => (
            <ReferenceArea
              key={band.label}
              y1={band.y1}
              y2={band.y2}
              fill={band.color}
              fillOpacity={zoneFillOpacity}
              strokeOpacity={0}
              ifOverflow="hidden"
            />
          ))}
          {zoneLineYs.map((y) => (
            <ReferenceLine
              key={y}
              y={y}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="4 3"
              ifOverflow="hidden"
            />
          ))}
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="axisLabel"
            stroke="#64748b"
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "rgba(148,163,184,0.25)" }}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis
            domain={yDomain ?? ["auto", "auto"]}
            allowDataOverflow
            tickCount={profile.tickCount}
            tickFormatter={tickFormatter}
            stroke="#64748b"
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "rgba(148,163,184,0.25)" }}
            width={profile.narrowRange ? 44 : 40}
          />
          {profile.showArea ? (
            <defs>
              <linearGradient id={areaGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.2} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0.03} />
              </linearGradient>
            </defs>
          ) : null}
          {profile.showArea && pointCount >= 2 ? (
            <Area
              type={curveType}
              dataKey={lineDataKey}
              stroke="none"
              fill={`url(#${areaGradientId})`}
              connectNulls={connectNulls}
              isAnimationActive={false}
            />
          ) : null}
          <Tooltip
            content={(tipProps) => (
              <HistoryTooltipContent
                {...tipProps}
                dataLabel={dataLabel}
                profileKey={profileKey}
              />
            )}
            cursor={{ stroke: "rgba(148,163,184,0.35)", strokeWidth: 1 }}
          />
          <Line
            type={curveType}
            dataKey={lineDataKey}
            stroke={stroke}
            strokeWidth={pointCount === 1 ? 0 : lineStrokeWidth}
            dot={
              hasInflectionDots
                ? InflectionDot
                : showDots
                  ? { r: pointCount === 1 ? 5 : 4, fill: stroke, stroke: "#0b0e14", strokeWidth: 1.5 }
                  : false
            }
            activeDot={{
              r: profile.activeDotR ?? 5,
              strokeWidth: 2,
              fill: stroke,
              stroke: profile.narrowRange ? "#0b0e14" : undefined,
            }}
            connectNulls={connectNulls}
            isAnimationActive={false}
          />
          </LineChart>
        </ResponsiveContainer>
        {useInsightPalette && showZoneBands && yDomain && zoneLabels.length > 0 ? (
          <ZoneYAxisLabels bands={zoneLabels} yDomain={yDomain} height={height} />
        ) : null}
      </div>
    </div>
  )
}
