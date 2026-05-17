import { useMemo } from "react"
import {
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
            domain={[`dataMin - ${DOMAIN_PAD}`, `dataMax + ${DOMAIN_PAD}`]}
            stroke="#64748b"
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "rgba(148,163,184,0.25)" }}
            width={40}
          />
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
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 2, fill: stroke }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
