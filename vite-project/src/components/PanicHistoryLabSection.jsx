import { useMemo, useState } from "react"
import { LAB_CHART_RANGES, sliceHistoryByLabRange } from "../utils/chartRange.js"
import {
  buildPanicLabChartData,
  LAB_METRICS,
  latestLabSnapshot,
  PANIC_STAGE_BANDS,
} from "../utils/panicHistoryLab.js"
import PanicHistoryLabChart from "./PanicHistoryLabChart.jsx"

const DEFAULT_VISIBLE = {
  composite: true,
  vix: true,
  fearGreed: true,
  putCall: false,
  bofa: false,
  highYield: false,
  move: false,
  skew: false,
  gsBullBear: false,
}

/** @param {{ rows?: object[] }} props */
export default function PanicHistoryLabSection({ rows = [] }) {
  const [rangeId, setRangeId] = useState("6M")
  const [visibleKeys, setVisibleKeys] = useState(DEFAULT_VISIBLE)

  const slicedRows = useMemo(() => sliceHistoryByLabRange(rows, rangeId), [rows, rangeId])

  const chartData = useMemo(() => buildPanicLabChartData(slicedRows), [slicedRows])

  const latest = useMemo(() => latestLabSnapshot(chartData), [chartData])

  const defaultWindow = useMemo(() => {
    const preset = LAB_CHART_RANGES.find((r) => r.id === rangeId)
    return preset?.days ?? chartData.length
  }, [rangeId, chartData.length])

  const toggleSeries = (key) => {
    setVisibleKeys((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <section className="trading-card-shell mt-6 overflow-hidden px-2.5 py-2.5 sm:px-3 sm:py-3">
      <div className="border-l-2 border-cyan-400/50 pl-2">
        <p className="m-0 text-[12px] font-bold tracking-[0.02em] text-slate-100">패닉 히스토리 랩</p>
        <p className="m-0 mt-0.5 text-[10px] text-slate-500">
          panic_index_history · 정규화 0~100 · 복합 패닉지수
        </p>
      </div>

      {latest ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-2">
          <span
            className="rounded-full px-2.5 py-0.5 text-[10px] font-bold"
            style={{
              backgroundColor: `${latest.stageColor}33`,
              color: latest.stageColor,
              border: `1px solid ${latest.stageColor}55`,
            }}
          >
            {latest.stageLabel}
          </span>
          <span className="font-mono text-[13px] font-bold tabular-nums text-slate-100">
            복합 {latest.composite != null ? Math.round(latest.composite) : "—"}
            <span className="ml-1 text-[10px] font-normal text-slate-500">/ 100</span>
          </span>
          <span className="text-[10px] text-slate-500">{latest.date}</span>
        </div>
      ) : null}

      <div className="mt-2.5 flex flex-wrap gap-1">
        {LAB_CHART_RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRangeId(r.id)}
            className={[
              "rounded-md px-2 py-1 font-mono text-[10px] font-medium tabular-nums transition",
              rangeId === r.id
                ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/30"
                : "text-slate-500 hover:bg-white/[0.05] hover:text-slate-300",
            ].join(" ")}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <SeriesChip
          label="복합"
          accent="#f8fafc"
          on={visibleKeys.composite !== false}
          onClick={() => toggleSeries("composite")}
        />
        {LAB_METRICS.map((m) => (
          <SeriesChip
            key={m.key}
            label={m.label}
            accent={m.accent}
            on={Boolean(visibleKeys[m.key])}
            onClick={() => toggleSeries(m.key)}
          />
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {PANIC_STAGE_BANDS.map((band) => (
          <span
            key={band.id}
            className="inline-flex items-center gap-1 text-[9px] text-slate-500"
          >
            <span className="h-2 w-3 rounded-sm" style={{ backgroundColor: `${band.color}66` }} />
            {band.label}
          </span>
        ))}
      </div>

      <div className="mt-3">
        <PanicHistoryLabChart
          data={chartData}
          visibleKeys={visibleKeys}
          defaultWindow={defaultWindow}
        />
      </div>
    </section>
  )
}

/** @param {{ label: string; accent: string; on: boolean; onClick: () => void }} props */
function SeriesChip({ label, accent, on, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-md border px-2 py-0.5 text-[10px] font-semibold transition",
        on
          ? "border-white/20 bg-white/[0.08] text-slate-100"
          : "border-white/[0.05] bg-transparent text-slate-600 hover:text-slate-400",
      ].join(" ")}
      style={on ? { boxShadow: `0 0 10px ${accent}22` } : undefined}
    >
      <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
      {label}
    </button>
  )
}
