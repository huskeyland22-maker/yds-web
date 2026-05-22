import { useEffect, useMemo, useRef, useState } from "react"
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
  logHistoryFetchDebug,
  logHistoryMetricMapping,
  probePanicIndexHistoryDirect,
} from "../utils/panicHistoryFetchDebug.js"
import { mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { buildHistoryChartPayload } from "../utils/panicHistoryChart.js"
import { countHistoryMetricPoints, resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import PanicHistoryLineChart from "./PanicHistoryLineChart.jsx"

const HISTORY_CHART_HEIGHT = 240

/**
 * @param {{ rows?: object[] }} props
 */
export default function PanicIndexHistorySection({ rows: rowsProp = [] }) {
  const storeRows = useAppDataStore((s) => s.cycleMetricHistory)
  const loadCycleHistoryBundle = useAppDataStore((s) => s.loadCycleHistoryBundle)

  useEffect(() => {
    void probePanicIndexHistoryDirect()
    void loadCycleHistoryBundle({ limit: 500, force: false })
  }, [loadCycleHistoryBundle])

  const history = useMemo(() => {
    const propsMerged = mergeCycleRows(storeRows ?? [], rowsProp ?? [])
    const merged = resolveCycleHistoryRows(propsMerged)
    console.log("render history", merged.length)
    return merged
  }, [rowsProp, storeRows])

  const [activeHistoryTab, setActiveHistoryTab] = useState("vix")
  const [rangeId, setRangeId] = useState("6M")
  const didInitMetricRef = useRef(false)

  useEffect(() => {
    if (!history.length || didInitMetricRef.current) return
    didInitMetricRef.current = true
  }, [history.length])

  const metricKey = activeHistoryTab

  const metric = useMemo(
    () => HISTORY_SECTION_METRICS.find((m) => m.key === activeHistoryTab) ?? HISTORY_SECTION_METRICS[0],
    [activeHistoryTab],
  )

  const slicedRows = useMemo(() => sliceHistoryByLabRange(history, rangeId), [history, rangeId])

  const metricCounts = useMemo(() => {
    const counts = {}
    for (const m of HISTORY_SECTION_METRICS) {
      counts[m.key] = countHistoryMetricPoints(history, m.key)
    }
    return counts
  }, [history])

  const chartPayload = useMemo(
    () => buildHistoryChartPayload(slicedRows.length ? slicedRows : history, activeHistoryTab),
    [slicedRows, history, activeHistoryTab],
  )

  useEffect(() => {
    logHistoryFetchDebug(history, activeHistoryTab, rangeId)
    logHistoryMetricMapping(history)
    console.log(activeHistoryTab, chartPayload.selectedField, chartPayload.chartData)
    console.log("[YDS] panic history resolved", {
      propsRows: rowsProp?.length ?? 0,
      storeRows: storeRows?.length ?? 0,
      historyLength: history.length,
      slicedLength: slicedRows.length,
      activeHistoryTab,
      selectedField: chartPayload.selectedField,
      selectedRange: rangeId,
    })
  }, [history, slicedRows.length, activeHistoryTab, rangeId, chartPayload, rowsProp?.length, storeRows?.length])

  const stats = useMemo(
    () => computeHistoryMetricStats(slicedRows.length ? slicedRows : history, metricKey),
    [slicedRows, history, metricKey],
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
  const chartRows = chartPayload?.chartData ?? []
  const showChart = chartRows.length > 0

  console.log("render history", history.length, "chart", chartPayload.chartData.length, activeHistoryTab)

  return (
    <section className="panic-history-section trading-card-shell panic-v2-section overflow-hidden px-2 pb-2 sm:px-2.5">
      <div className="panic-history-section__head border-l-2 border-cyan-400/45 pl-2">
        <p className="m-0 text-[11px] font-bold text-slate-100">패닉 히스토리</p>
        <p className="m-0 text-[9px] text-slate-500">
          {metric.label} · {rangeId} · 실제 {chartRangeStats(history, rangeId, "lab").shown}일
          {history.length > 0 ? ` · 전체 ${history.length}일` : ""}
        </p>
      </div>

      <div className="panic-history-tabs mt-1.5 flex flex-wrap gap-1">
        {HISTORY_SECTION_METRICS.map((m) => {
          const n = metricCounts[m.key] ?? 0
          const active = activeHistoryTab === m.key
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setActiveHistoryTab(m.key)}
              className={[
                "panic-history-tab inline-flex max-w-full items-center gap-0.5 rounded-md border px-1.5 py-1 transition",
                active
                  ? "border-white/20 bg-white/12 text-slate-50 ring-1 ring-white/12"
                  : "border-transparent bg-transparent text-slate-400 hover:border-white/10 hover:text-slate-200",
              ].join(" ")}
              style={active ? { boxShadow: `0 0 10px ${m.accent}28` } : undefined}
              title={m.tooltip ? `${m.label} · ${m.tooltip} · ${n}일` : `${m.label} · ${n}일`}
              aria-pressed={active}
            >
              <span className="panic-history-tab__label whitespace-nowrap">{m.label}</span>
              <span className="panic-history-tab__count font-mono text-[8px] tabular-nums opacity-75">
                {n}
              </span>
            </button>
          )
        })}
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

      <div className="panic-history-section__chart mt-1 pb-2">
        {showChart ? (
          <PanicHistoryLineChart
            key={`panic-hist-${activeHistoryTab}`}
            rows={slicedRows.length ? slicedRows : history}
            chartData={chartRows}
            dataKey={chartPayload?.dataKey ?? "value"}
            metricField={chartPayload?.selectedField ?? metricKey}
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
