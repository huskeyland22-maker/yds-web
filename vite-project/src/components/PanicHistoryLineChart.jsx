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
import { metricZoneBands, metricZoneLineYs } from "../utils/panicHistoryZoneLines.js"
import {
  computeHistoryYDomain,
  extractChartValues,
  resolveChartProfile,
  yAxisTickFormatter,
} from "../utils/chartMetricProfiles.js"
import { buildChartDataFromHistory, logHistoryChartDebug } from "../utils/panicHistoryDesk.js"
import { formatMetricValue } from "./macroCycleChartUtils.js"

const CHART_HEIGHT = 340

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

  const areaGradientId = `metricArea-${dataKey.replace(/[^a-zA-Z0-9]/g, "")}`

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
        <LineChart data={chartData} margin={{ top: 28, right: 18, left: 8, bottom: 32 }}>
          {zoneBands.map((band) => (
            <ReferenceArea
              key={band.label}
              y1={band.y1}
              y2={band.y2}
              fill={band.color}
              fillOpacity={0.07}
              strokeOpacity={0}
              ifOverflow="hidden"
            />
          ))}
          {zoneLineYs.map((y) => (
            <ReferenceLine
              key={y}
              y={y}
              stroke="rgba(255,255,255,0.14)"
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
            strokeWidth={profile.strokeWidth ?? 3}
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
    </div>
  )
}
