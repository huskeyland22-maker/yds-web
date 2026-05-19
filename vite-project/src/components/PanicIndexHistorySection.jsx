import { useEffect, useMemo, useState } from "react"
import { useAppDataStore } from "../store/appDataStore.js"
import { chartRangeStats, LAB_CHART_RANGES, sliceHistoryByLabRange } from "../utils/chartRange.js"
import {
  computeHistoryMetricStats,
  HIGHER_IS_BAD,
  historyChangeToneClass,
} from "../utils/panicHistoryStats.js"
import { HISTORY_SECTION_METRICS } from "../utils/panicDeskMetrics.js"
import { historyZoneLegendItems } from "../utils/panicHistoryLegend.js"
import {
  filterHistoryRowsForMetric,
  resolveCycleHistoryRows,
  resolveDefaultHistoryMetric,
} from "../utils/panicHistoryRows.js"
import PanicHistoryLineChart from "./PanicHistoryLineChart.jsx"

const HISTORY_CHART_HEIGHT = 240

/**
 * @param {{ rows?: object[] }} props
 */
export default function PanicIndexHistorySection({ rows: rowsProp = [] }) {
  const storeRows = useAppDataStore((s) => s.cycleMetricHistory)
  const loadCycleHistoryBundle = useAppDataStore((s) => s.loadCycleHistoryBundle)

  useEffect(() => {
    void loadCycleHistoryBundle({ limit: 500, force: false })
  }, [loadCycleHistoryBundle])

  const history = useMemo(() => {
    const fromProps = resolveCycleHistoryRows(rowsProp)
    if (fromProps.length) return fromProps
    return resolveCycleHistoryRows(storeRows)
  }, [rowsProp, storeRows])

  const [metricKey, setMetricKey] = useState("vix")
  const [rangeId, setRangeId] = useState("6M")

  useEffect(() => {
    if (!history.length) return
    const next = resolveDefaultHistoryMetric(history, "vix")
    if (next !== metricKey) setMetricKey(next)
  }, [history, metricKey])

  const metric = useMemo(
    () => HISTORY_SECTION_METRICS.find((m) => m.key === metricKey) ?? HISTORY_SECTION_METRICS[0],
    [metricKey],
  )

  const slicedRows = useMemo(() => sliceHistoryByLabRange(history, rangeId), [history, rangeId])

  const filteredHistory = useMemo(
    () => filterHistoryRowsForMetric(slicedRows, metricKey),
    [slicedRows, metricKey],
  )

  useEffect(() => {
    console.log("[YDS] panic history", {
      historyLength: history.length,
      filteredHistoryLength: filteredHistory.length,
      selectedMetric: metricKey,
      selectedRange: rangeId,
    })
  }, [history.length, filteredHistory.length, metricKey, rangeId])

  const stats = useMemo(
    () => computeHistoryMetricStats(filteredHistory.length ? filteredHistory : slicedRows, metricKey),
    [filteredHistory, slicedRows, metricKey],
  )

  const zoneLegend = useMemo(() => historyZoneLegendItems(metricKey), [metricKey])

  const chartSummary = useMemo(
    () => ({
      currentText: stats.currentText,
      statusLabel: stats.statusLabel,
      percentileLabel: stats.percentileLabel,
      dayText: stats.dayText,
    }),
    [stats],
  )

  const higherIsBad = HIGHER_IS_BAD[metricKey] ?? true
  const chartRows = filteredHistory.length > 0 ? filteredHistory : slicedRows
  const showChart = chartRows.length > 0

  return (
    <section className="trading-card-shell panic-v2-section overflow-hidden px-2 py-2 sm:px-2.5">
      <div className="border-l-2 border-cyan-400/45 pl-2">
        <p className="m-0 text-[11px] font-bold text-slate-100">패닉 히스토리</p>
        <p className="m-0 text-[9px] text-slate-500">
          {metric.label} · {rangeId} · 실제 {chartRangeStats(history, rangeId, "lab").shown}일
        </p>
      </div>

      <div className="mt-1.5 flex flex-wrap gap-0.5">
        {HISTORY_SECTION_METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMetricKey(m.key)}
            className={[
              "rounded px-1.5 py-0.5 text-[9px] font-semibold transition sm:text-[10px]",
              metricKey === m.key
                ? "bg-white/12 text-slate-100 ring-1 ring-white/15"
                : "text-slate-500 hover:text-slate-300",
            ].join(" ")}
            style={metricKey === m.key ? { boxShadow: `0 0 8px ${m.accent}22` } : undefined}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="mt-1 flex flex-wrap gap-0.5">
        {LAB_CHART_RANGES.map((r) => {
          const st = chartRangeStats(history, r.id, "lab")
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setRangeId(r.id)}
              className={[
                "rounded px-1.5 py-0.5 font-mono text-[9px] tabular-nums",
                rangeId === r.id ? "bg-cyan-500/15 text-cyan-100" : "text-slate-600",
              ].join(" ")}
              title={`실제 ${st.shown}일 / 전체 ${st.total}일`}
            >
              {r.label}
              <span className="ml-0.5 text-[8px] opacity-80">({st.shown})</span>
            </button>
          )
        })}
      </div>

      <div className="mt-1.5 grid grid-cols-4 gap-1 sm:grid-cols-8">
        <StatCell label="현재" value={stats.currentText} accent />
        <StatCell label="저점" value={stats.lowText} />
        <StatCell label="고점" value={stats.highText} />
        <StatCell label="상태" value={stats.statusLabel} />
        <StatCell
          label="전일"
          value={stats.dayText}
          valueClassName={historyChangeToneClass(stats.dayPct, higherIsBad, stats.dayPending)}
        />
        <StatCell label="백분위" value={stats.percentileLabel} />
        <StatCell
          label="1주"
          value={stats.weekText}
          valueClassName={historyChangeToneClass(stats.weekPct, higherIsBad, stats.weekPending)}
        />
        <StatCell
          label="1M"
          value={stats.monthText}
          valueClassName={historyChangeToneClass(stats.monthPct, higherIsBad, stats.monthPending)}
        />
      </div>

      {zoneLegend.length > 0 ? (
        <div className="mt-1 flex flex-wrap gap-1">
          {zoneLegend.map((z) => (
            <span
              key={z.id ?? z.label}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-1.5 py-px text-[8px] text-slate-400"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: z.color }} />
              {z.label}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-1.5 pb-1">
        {showChart ? (
          <PanicHistoryLineChart
            rows={chartRows}
            dataKey={metricKey}
            dataLabel={metric.chartLabel}
            stroke={metric.accent}
            showZoneBands
            height={HISTORY_CHART_HEIGHT}
            summary={chartSummary}
          />
        ) : (
          <div
            className="flex h-[80px] items-center justify-center rounded border border-white/[0.06] bg-black/20 text-[10px] text-slate-500"
          >
            히스토리 없음
          </div>
        )}
      </div>
    </section>
  )
}

/** @param {{ label: string; value: string; accent?: boolean; valueClassName?: string }} props */
function StatCell({ label, value, accent = false, valueClassName = "" }) {
  const valueTone = valueClassName || (accent ? "text-slate-50" : "text-slate-300")
  return (
    <div className="rounded border border-white/[0.05] bg-black/25 px-1 py-1">
      <p className="m-0 text-[7px] font-semibold uppercase text-slate-600">{label}</p>
      <p className={["m-0 mt-0.5 truncate font-mono text-[10px] font-bold tabular-nums", valueTone].join(" ")}>
        {value}
      </p>
    </div>
  )
}
