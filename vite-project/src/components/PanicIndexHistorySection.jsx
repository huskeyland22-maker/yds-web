import { useMemo, useState } from "react"
import { CHART_RANGES, sliceHistoryByRange } from "../utils/chartRange.js"
import {
  computeHistoryMetricStats,
  HIGHER_IS_BAD,
  historyChangeToneClass,
} from "../utils/panicHistoryStats.js"
import { HISTORY_SECTION_METRICS } from "../utils/panicDeskMetrics.js"
import { MOOD_SPECTRUM } from "../utils/panicDeskMood.js"
import { metricZoneBands } from "../utils/panicHistoryZoneLines.js"
import PanicHistoryLineChart from "./PanicHistoryLineChart.jsx"

const HISTORY_CHART_HEIGHT = 280

/**
 * @param {{ rows: object[] }} props
 */
export default function PanicIndexHistorySection({ rows = [] }) {
  const [metricKey, setMetricKey] = useState("vix")
  const [rangeId, setRangeId] = useState("6M")

  const metric = useMemo(
    () => HISTORY_SECTION_METRICS.find((m) => m.key === metricKey) ?? HISTORY_SECTION_METRICS[0],
    [metricKey],
  )

  const slicedRows = useMemo(() => sliceHistoryByRange(rows, rangeId), [rows, rangeId])

  const stats = useMemo(
    () => computeHistoryMetricStats(slicedRows, metricKey),
    [slicedRows, metricKey],
  )

  const zoneLegend = useMemo(() => {
    if (metricKey === "fearGreed") return MOOD_SPECTRUM
    return metricZoneBands(metricKey).map((b) => ({
      id: b.label,
      label: b.label,
      color: b.color,
    }))
  }, [metricKey])

  const hasData = Array.isArray(slicedRows) && slicedRows.length > 0

  return (
    <section className="trading-card-shell mt-6 overflow-hidden px-2.5 py-2.5 sm:px-3 sm:py-3">
      <p className="m-0 border-l-2 border-indigo-400/45 pl-2 text-[11px] font-bold tracking-[0.02em] text-slate-200">
        패닉지수 히스토리
      </p>

      <div className="mt-2.5 flex flex-wrap gap-1">
        {HISTORY_SECTION_METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMetricKey(m.key)}
            className={[
              "rounded-md border px-2 py-1 text-[10px] font-semibold transition",
              metricKey === m.key
                ? "border-white/25 bg-white/[0.1] text-slate-100"
                : "border-white/[0.06] bg-white/[0.02] text-slate-500 hover:border-white/12 hover:text-slate-300",
            ].join(" ")}
            style={metricKey === m.key ? { boxShadow: `0 0 12px ${m.accent}22` } : undefined}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
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

      <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-8">
        <StatCell label="현재" value={stats.currentText} accent />
        <StatCell label="최근 저점" value={stats.lowText} />
        <StatCell label="최근 고점" value={stats.highText} />
        <StatCell label="백분위" value={stats.percentileLabel} />
        <StatCell label="상태" value={stats.statusLabel} />
        <StatCell
          label="전일"
          value={stats.dayText}
          valueClassName={historyChangeToneClass(stats.dayPct, HIGHER_IS_BAD[metricKey] ?? true)}
        />
        <StatCell
          label="1주"
          value={stats.weekText}
          valueClassName={historyChangeToneClass(stats.weekPct, HIGHER_IS_BAD[metricKey] ?? true)}
        />
        <StatCell
          label="1개월"
          value={stats.monthText}
          valueClassName={historyChangeToneClass(stats.monthPct, HIGHER_IS_BAD[metricKey] ?? true)}
        />
      </div>

      {zoneLegend.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {zoneLegend.map((z) => (
            <span
              key={z.id ?? z.label}
              className="inline-flex items-center gap-1 rounded border border-white/[0.06] bg-white/[0.02] px-1.5 py-px text-[8px] text-slate-500"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: z.color }} />
              {z.label}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-2">
        {hasData ? (
          <PanicHistoryLineChart
            rows={slicedRows}
            dataKey={metricKey}
            dataLabel={metric.chartLabel}
            stroke={metric.accent}
            showZoneBands
            height={HISTORY_CHART_HEIGHT}
          />
        ) : (
          <div
            className="flex items-center justify-center rounded-lg border border-white/[0.06] bg-black/30 text-[11px] text-slate-500"
            style={{ height: HISTORY_CHART_HEIGHT }}
          >
            선택 구간에 데이터가 없습니다
          </div>
        )}
      </div>
    </section>
  )
}

/**
 * @param {{ label: string; value: string; accent?: boolean; className?: string; valueClassName?: string }} props
 */
function StatCell({ label, value, accent = false, className = "", valueClassName = "" }) {
  const valueTone =
    valueClassName || (accent ? "text-slate-50" : "text-slate-300")

  return (
    <div
      className={[
        "rounded-md border border-white/[0.06] bg-[#070a10]/80 px-2 py-1.5",
        className,
      ].join(" ")}
    >
      <p className="m-0 text-[8px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={[
          "m-0 mt-0.5 font-mono text-[12px] font-bold tabular-nums leading-tight",
          valueTone,
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  )
}
