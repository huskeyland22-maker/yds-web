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
const CHART_MARGIN = { top: 28, right: 58, left: 8, bottom: 32 }

/**
 * @param {{ bands: { y: number; label: string; color: string }[]; yDomain: [number, number]; height: number }} props
 */
function ZoneYAxisLabels({ bands, yDomain, height }) {
  const [yMin, yMax] = yDomain
  const span = yMax - yMin
  if (!Number.isFinite(span) || span <= 0) return null

  const plotTop = CHART_MARGIN.top
  const plotHeight = height - CHART_MARGIN.top - CHART_MARGIN.bottom
  const yToTop = (y) => plotTop + ((yMax - y) / span) * plotHeight

  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-[54px]" aria-hidden>
      {bands.map((band) => {
        if (band.y < yMin || band.y > yMax) return null
        const top = yToTop(band.y)
        return (
          <span
            key={band.label}
            className="absolute right-0 max-w-[52px] truncate text-right text-[8px] font-medium leading-none text-slate-500/90"
            style={{ top: top - 5 }}
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
 *   rows: object[]
 *   dataKey: string
 *   dataLabel?: string
 *   stroke?: string
 *   showZoneBands?: boolean
 *   height?: number
 *   debug?: boolean
 * }} props
 */
export default function PanicHistoryLineChart({
  rows,
  dataKey = "vix",
  dataLabel = "VIX",
  stroke = "#22d3ee",
  showZoneBands = false,
  height = CHART_HEIGHT,
  debug = false,
}) {
  const chartData = useMemo(() => {
    const data = buildChartDataFromHistory(rows, dataKey)
    if (debug) logHistoryChartDebug(rows, data)
    return data
  }, [rows, dataKey, debug])

  const profile = useMemo(() => resolveChartProfile(dataKey), [dataKey])

  const zoneBands = useMemo(
    () => (showZoneBands ? metricZoneBands(dataKey) : []),
    [showZoneBands, dataKey],
  )
  const zoneLineYs = useMemo(
    () => (showZoneBands ? metricZoneLineYs(dataKey) : []),
    [showZoneBands, dataKey],
  )

  const yDomain = useMemo(() => {
    const values = extractChartValues(chartData, dataKey)
    return computeHistoryYDomain(values, dataKey, { showZoneBands })
  }, [chartData, dataKey, showZoneBands])

  const tickFormatter = useMemo(() => yAxisTickFormatter(profile), [profile])

  const zoneLabels = useMemo(() => {
    if (!showZoneBands || !zoneBands.length || !yDomain) return []
    return zoneBandMidpoints(zoneBands)
  }, [showZoneBands, zoneBands, yDomain])

  const areaGradientId = `metricArea-${dataKey.replace(/[^a-zA-Z0-9]/g, "")}`
  const lineStrokeWidth = (profile.strokeWidth ?? 3) + (showZoneBands ? 0.5 : 0)

  if (!Array.isArray(rows) || rows.length < 1 || chartData.length < 1) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-white/[0.06] bg-black/30 text-[11px] text-slate-500"
        style={{ height, minHeight: height }}
      >
        panic_index_history 데이터 없음
      </div>
    )
  }

  return (
    <div className="relative w-full overflow-visible" style={{ height, minHeight: height }}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={CHART_MARGIN}>
          {zoneBands.map((band) => (
            <ReferenceArea
              key={band.label}
              y1={band.y1}
              y2={band.y2}
              fill={band.color}
              fillOpacity={ZONE_BAND_FILL_OPACITY}
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
          {profile.showArea ? (
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke="none"
              fill={`url(#${areaGradientId})`}
              connectNulls
              isAnimationActive={false}
            />
          ) : null}
          <Tooltip
            contentStyle={{
              background: "#0a0e16",
              border: "1px solid rgba(148,163,184,0.35)",
              borderRadius: 6,
              fontSize: 11,
            }}
            labelStyle={{ color: "#94a3b8" }}
            formatter={(value) => [formatMetricValue(dataKey, value), dataLabel]}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={stroke}
            strokeWidth={lineStrokeWidth}
            dot={false}
            activeDot={{
              r: profile.activeDotR ?? 5,
              strokeWidth: 2,
              fill: stroke,
              stroke: profile.narrowRange ? "#0b0e14" : undefined,
            }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      {showZoneBands && yDomain && zoneLabels.length > 0 ? (
        <ZoneYAxisLabels bands={zoneLabels} yDomain={yDomain} height={height} />
      ) : null}
    </div>
  )
}
