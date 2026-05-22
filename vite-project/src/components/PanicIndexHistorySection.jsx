import { useEffect, useMemo, useRef, useState } from "react"
import { useAppDataStore } from "../store/appDataStore.js"
import { chartRangeStats, LAB_CHART_RANGES, sliceHistoryByLabRange } from "../utils/chartRange.js"
import { HISTORY_SECTION_METRICS } from "../utils/panicDeskMetrics.js"
import { historyZoneLegendItems } from "../utils/panicHistoryLegend.js"
import {
  buildPanicHistoryInsight,
  mergeInflectionsIntoChartData,
} from "../utils/buildPanicHistoryInsight.js"
import { mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { buildHistoryChartPayload } from "../utils/panicHistoryChart.js"
import { countHistoryMetricPoints, resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import PanicHistoryInsightPanel from "./panic-history/PanicHistoryInsightPanel.jsx"
import PanicHistoryLineChart from "./PanicHistoryLineChart.jsx"

const HISTORY_CHART_HEIGHT = 260

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
    const propsMerged = mergeCycleRows(storeRows ?? [], rowsProp ?? [])
    return resolveCycleHistoryRows(propsMerged)
  }, [rowsProp, storeRows])

  const [activeHistoryTab, setActiveHistoryTab] = useState("vix")
  const [rangeId, setRangeId] = useState("6M")
  const didInitMetricRef = useRef(false)

  useEffect(() => {
    if (!history.length || didInitMetricRef.current) return
    didInitMetricRef.current = true
  }, [history.length])

  const metric = useMemo(
    () => HISTORY_SECTION_METRICS.find((m) => m.key === activeHistoryTab) ?? HISTORY_SECTION_METRICS[0],
    [activeHistoryTab],
  )

  const slicedRows = useMemo(() => sliceHistoryByLabRange(history, rangeId), [history, rangeId])
  const chartRowsSource = slicedRows.length ? slicedRows : history

  const metricCounts = useMemo(() => {
    const counts = {}
    for (const m of HISTORY_SECTION_METRICS) {
      counts[m.key] = countHistoryMetricPoints(history, m.key)
    }
    return counts
  }, [history])

  const chartPayload = useMemo(
    () => buildHistoryChartPayload(chartRowsSource, activeHistoryTab),
    [chartRowsSource, activeHistoryTab],
  )

  const insight = useMemo(
    () => buildPanicHistoryInsight(chartRowsSource, history, activeHistoryTab),
    [chartRowsSource, history, activeHistoryTab],
  )

  const zoneLegend = useMemo(() => historyZoneLegendItems(activeHistoryTab), [activeHistoryTab])

  const chartRows = useMemo(() => {
    const base = chartPayload?.chartData ?? []
    return mergeInflectionsIntoChartData(base, insight.inflections)
  }, [chartPayload?.chartData, insight.inflections])

  const showChart = chartRows.length > 0

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

      <PanicHistoryInsightPanel
        header={insight.header}
        changeStrip={insight.changeStrip}
        interpretationLines={insight.interpretationLines}
        bottomInsight={insight.bottomInsight}
        metricKey={activeHistoryTab}
        accent={metric.accent}
      />

      <div className="panic-history-zone-legend mt-1 flex flex-wrap items-center gap-1">
        <span className="panic-history-zone-legend__chip panic-history-zone-legend__chip--floor">
          저점
        </span>
        <span className="panic-history-zone-legend__chip panic-history-zone-legend__chip--transition">
          전환
        </span>
        <span className="panic-history-zone-legend__chip panic-history-zone-legend__chip--risk">
          과열
        </span>
        {zoneLegend.length > 0 ? (
          <span className="ml-1 text-[8px] text-slate-600">
            · {zoneLegend.map((z) => z.label).join(" / ")}
          </span>
        ) : null}
      </div>

      <div className="panic-history-section__chart mt-1 pb-2">
        {showChart ? (
          <PanicHistoryLineChart
            key={`panic-hist-v2-${activeHistoryTab}-${rangeId}`}
            rows={chartRowsSource}
            chartData={chartRows}
            dataKey={chartPayload?.dataKey ?? "value"}
            metricField={chartPayload?.selectedField ?? activeHistoryTab}
            dataLabel={metric.chartLabel}
            stroke={metric.accent}
            showZoneBands={false}
            insightZones
            height={HISTORY_CHART_HEIGHT}
          />
        ) : (
          <div className="flex h-[80px] items-center justify-center rounded border border-white/[0.06] bg-black/20 text-[10px] text-slate-500">
            히스토리 없음
          </div>
        )}
      </div>
    </section>
  )
}
