import { useMemo, useState } from "react"
import { CHART_RANGES, sliceHistoryByRange } from "../utils/chartRange.js"
import PanicHistoryLineChart from "./PanicHistoryLineChart.jsx"

const METRIC_STROKES = {
  vix: "#f87171",
  fearGreed: "#fbbf24",
  putCall: "#60a5fa",
  highYield: "#fb923c",
  bofa: "#c084fc",
  move: "#fbbf24",
  skew: "#22d3ee",
  gsBullBear: "#a78bfa",
  vxn: "#2dd4bf",
}

/**
 * @param {{
 *   rows: object[]
 *   primarySeries: { key: string; name: string; color?: string }
 *   chartMetric: string
 * }} props
 */
export default function PanicDeskChart({ rows, primarySeries, chartMetric }) {
  const [rangeId, setRangeId] = useState("6M")

  const slicedRows = useMemo(() => sliceHistoryByRange(rows, rangeId), [rows, rangeId])
  const activeKey = chartMetric || primarySeries?.key || "vix"
  const stroke = primarySeries?.color ?? METRIC_STROKES[activeKey] ?? "#22d3ee"
  const hasHistory = Array.isArray(slicedRows) && slicedRows.length > 0

  return (
    <section className="trading-card-shell overflow-visible">
      <div className="flex flex-wrap items-center justify-end gap-2 border-b border-white/[0.06] px-2.5 py-1.5">
        <div className="flex flex-wrap items-center gap-1">
          {CHART_RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRangeId(r.id)}
              className={[
                "rounded-md px-2 py-1 font-mono text-[10px] font-medium tabular-nums transition",
                rangeId === r.id
                  ? "bg-white/[0.12] text-slate-100"
                  : "text-slate-500 hover:bg-white/[0.05] hover:text-slate-300",
              ].join(" ")}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-visible p-1 sm:p-1.5">
        {hasHistory ? (
          <PanicHistoryLineChart
            rows={slicedRows}
            dataKey={activeKey}
            dataLabel={primarySeries?.name ?? activeKey}
            stroke={stroke}
          />
        ) : (
          <div className="flex h-[340px] items-center justify-center text-[11px] text-slate-500">
            panic_index_history — 데이터 없음
          </div>
        )}
      </div>
    </section>
  )
}
