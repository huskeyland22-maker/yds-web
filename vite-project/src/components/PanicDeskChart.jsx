import { useMemo, useState } from "react"
import { CHART_RANGES, sliceHistoryByRange } from "../utils/chartRange.js"
import MacroCycleLwChart from "./MacroCycleLwChart.jsx"

/**
 * @param {{
 *   rows: object[]
 *   primarySeries: { key: string; name: string; color?: string }
 *   chartMetric: string
 *   onMetricChange: (key: string) => void
 * }} props
 */
export default function PanicDeskChart({ rows, primarySeries }) {
  const [rangeId, setRangeId] = useState("6M")

  const slicedRows = useMemo(() => sliceHistoryByRange(rows, rangeId), [rows, rangeId])
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
        <MacroCycleLwChart
          rows={slicedRows}
          primarySeries={{
            key: primarySeries.key,
            name: primarySeries.name,
            color: primarySeries.color,
          }}
          compact
          showVolume={false}
        />
      </div>
    </section>
  )
}
