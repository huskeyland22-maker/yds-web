import { useMemo } from "react"
import {
  Area,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { buildChartDataFromHistory, logHistoryChartDebug } from "../utils/panicHistoryDesk.js"
import { formatMetricValue } from "./macroCycleChartUtils.js"

const CHART_HEIGHT = 340
const DOMAIN_PAD = 0.3
const PUT_CALL_DOMAIN_PAD = 0.03

/**
 * panic_index_history 전용 Recharts 라인 (단일 시리즈)
 * @param {{
 *   rows: object[]
 *   dataKey: string
 *   dataLabel?: string
 *   stroke?: string
 * }} props
 */
export default function PanicHistoryLineChart({
  rows,
  dataKey = "vix",
  dataLabel = "VIX",
  stroke = "#22d3ee",
}) {
  const chartData = useMemo(() => {
    const data = buildChartDataFromHistory(rows, dataKey)
    logHistoryChartDebug(rows, data)
    return data
  }, [rows, dataKey])

  const isPutCall = dataKey === "putCall"

  const putCallYDomain = useMemo(() => {
    if (!isPutCall) return null
    const values = chartData
      .map((d) => d[dataKey])
      .filter((v) => v != null && Number.isFinite(Number(v)))
      .map(Number)
    if (values.length === 0) return null
    const min = Math.min(...values)
    const max = Math.max(...values)
    return [
      Number((min - PUT_CALL_DOMAIN_PAD).toFixed(2)),
      Number((max + PUT_CALL_DOMAIN_PAD).toFixed(2)),
    ]
  }, [chartData, dataKey, isPutCall])

  if (!Array.isArray(rows) || rows.length < 1 || chartData.length < 1) {
    return (
      <div className="flex h-[340px] min-h-[340px] items-center justify-center rounded-lg border border-white/[0.06] bg-black/30 text-[11px] text-slate-500">
        panic_index_history 데이터 없음
      </div>
    )
  }

  return (
    <div className="relative w-full overflow-visible" style={{ height: CHART_HEIGHT, minHeight: CHART_HEIGHT }}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart data={chartData} margin={{ top: 28, right: 18, left: 8, bottom: 32 }}>
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
            domain={
              isPutCall && putCallYDomain
                ? putCallYDomain
                : [`dataMin - ${DOMAIN_PAD}`, `dataMax + ${DOMAIN_PAD}`]
            }
            tickCount={isPutCall ? 6 : undefined}
            tickFormatter={isPutCall ? (v) => Number(v).toFixed(2) : undefined}
            stroke="#64748b"
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "rgba(148,163,184,0.25)" }}
            width={isPutCall ? 44 : 40}
          />
          {isPutCall ? (
            <defs>
              <linearGradient id="putCallAreaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.2} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0.03} />
              </linearGradient>
            </defs>
          ) : null}
          {isPutCall ? (
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke="none"
              fill="url(#putCallAreaFill)"
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
            strokeWidth={isPutCall ? 3.5 : 3}
            dot={false}
            activeDot={
              isPutCall
                ? { r: 6, strokeWidth: 2, fill: stroke, stroke: "#0b0e14" }
                : { r: 5, strokeWidth: 2, fill: stroke }
            }
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
