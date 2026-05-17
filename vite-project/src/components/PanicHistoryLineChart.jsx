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
const CHART_MARGIN = { top: 32, right: 52, left: 8, bottom: 32 }
const ZONE_LABEL_INSET = 14
const SUMMARY_PANEL_WIDTH = 116

/**
 * @typedef {{
 *   currentText: string
 *   statusLabel: string
 *   percentileLabel: string
 *   dayText: string
 * }} HistoryChartSummary
 */

/**
 * @param {{ summary: HistoryChartSummary; accent: string }} props
 */
function ChartSummaryFloater({ summary, accent }) {
  return (
    <div className="pointer-events-none sticky top-1 w-full rounded-md border border-white/12 bg-[#070a10]/95 px-2.5 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm">
      <p className="m-0 text-[8px] font-semibold uppercase tracking-wide text-slate-500">현재</p>
      <p className="m-0 font-mono text-[13px] font-extrabold tabular-nums leading-tight" style={{ color: accent }}>
        {summary.currentText}
      </p>
      <div className="mt-1.5 space-y-0.5 border-t border-white/[0.08] pt-1.5">
        <SummaryRow label="상태" value={summary.statusLabel} />
        <SummaryRow label="백분위" value={summary.percentileLabel} />
        <SummaryRow label="전일" value={summary.dayText} />
      </div>
    </div>
  )
}

/** @param {{ label: string; value: string }} props */
function SummaryRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[9px]">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="truncate text-right font-semibold text-slate-100">{value}</span>
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
 *   rows: object[]
 *   dataKey: string
 *   dataLabel?: string
 *   stroke?: string
 *   showZoneBands?: boolean
 *   height?: number
 *   summary?: HistoryChartSummary | null
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
  summary = null,
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
    <div className="flex w-full items-start gap-2 overflow-visible">
      <div className="relative min-w-0 flex-1" style={{ height, minHeight: height }}>
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
      {summary ? (
        <div
          className="shrink-0 self-start"
          style={{ width: SUMMARY_PANEL_WIDTH, minHeight: height }}
        >
          <ChartSummaryFloater summary={summary} accent={stroke} />
        </div>
      ) : null}
    </div>
  )
}
