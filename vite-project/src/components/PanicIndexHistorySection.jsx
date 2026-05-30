import { useEffect, useMemo, useState } from "react"
import { useAppDataStore } from "../store/appDataStore.js"
import { chartRangeStats, PANIC_INDEX_CHART_RANGES, sliceHistoryByLabRange } from "../utils/chartRange.js"
import {
  PANIC_INDEX_HISTORY_METRICS,
  PANIC_INDEX_HISTORY_ROWS,
} from "../utils/panicDeskMetrics.js"
import {
  buildPanicHistoryInsight,
  mergeInflectionsIntoChartData,
} from "../utils/buildPanicHistoryInsight.js"
import { mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { buildHistoryChartPayload } from "../utils/panicHistoryChart.js"
import { countHistoryMetricPoints, resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import { resolvePanicHistoryUiState } from "../utils/panicHistoryUiState.js"
import { isPanicHubEnabled } from "../config/api.js"
import PanicHistoryInsightPanel from "./panic-history/PanicHistoryInsightPanel.jsx"
import PanicHistoryLineChart from "./PanicHistoryLineChart.jsx"
import PanicDeskSectionHeader from "./panic-desk/PanicDeskSectionHeader.jsx"

const HISTORY_CHART_HEIGHT = 220
const DEFAULT_METRIC_KEY = "vix"

/**
 * @param {{ rows?: object[] }} props
 */
export default function PanicIndexHistorySection({ rows: rowsProp = [] }) {
  const storeRows = useAppDataStore((s) => s.cycleMetricHistory)
  const loadCycleHistoryBundle = useAppDataStore((s) => s.loadCycleHistoryBundle)
  const panicHistoryV2SyncStatus = useAppDataStore((s) => s.panicHistoryV2SyncStatus)

  useEffect(() => {
    void loadCycleHistoryBundle({ limit: 600, force: false })
  }, [loadCycleHistoryBundle])

  const history = useMemo(() => {
    const propsMerged = mergeCycleRows(storeRows ?? [], rowsProp ?? [])
    return resolveCycleHistoryRows(propsMerged)
  }, [rowsProp, storeRows])

  const [activeMetricKey, setActiveMetricKey] = useState(DEFAULT_METRIC_KEY)
  const [rangeId, setRangeId] = useState("3M")

  const metric = useMemo(() => {
    const found = PANIC_INDEX_HISTORY_METRICS.find((m) => m.key === activeMetricKey)
    return found ?? PANIC_INDEX_HISTORY_METRICS[0]
  }, [activeMetricKey])

  const slicedRows = useMemo(() => sliceHistoryByLabRange(history, rangeId), [history, rangeId])
  const chartRowsSource = slicedRows.length ? slicedRows : history

  const metricCounts = useMemo(() => {
    /** @type {Record<string, number>} */
    const counts = {}
    for (const m of PANIC_INDEX_HISTORY_METRICS) {
      counts[m.key] = countHistoryMetricPoints(history, m.key)
    }
    return counts
  }, [history])

  const chartPayload = useMemo(
    () => buildHistoryChartPayload(chartRowsSource, activeMetricKey),
    [chartRowsSource, activeMetricKey],
  )

  const insight = useMemo(
    () => buildPanicHistoryInsight(chartRowsSource, history, activeMetricKey),
    [chartRowsSource, history, activeMetricKey],
  )

  const chartRows = useMemo(() => {
    const base = chartPayload?.chartData ?? []
    return mergeInflectionsIntoChartData(base, insight.inflections)
  }, [chartPayload?.chartData, insight.inflections])

  const uiState = useMemo(
    () =>
      resolvePanicHistoryUiState({
        historyLength: history.length,
        panicV2Count: metricCounts[activeMetricKey] ?? 0,
        syncStatus: panicHistoryV2SyncStatus,
        hubEnabled: isPanicHubEnabled(),
      }),
    [history.length, metricCounts, activeMetricKey, panicHistoryV2SyncStatus],
  )

  const showHistoryLoading = history.length === 0
  const rangeStats = chartRangeStats(history, rangeId, "lab")

  const showChart =
    !showHistoryLoading && uiState.showChart && chartRows.some((x) => x?.value != null)

  const chartEmptyMessage = `${metric.shortLabel} 원본 데이터 준비중`

  return (
    <section className="panic-history-section trading-card-shell panic-v2-section overflow-hidden px-2 pb-2 sm:px-2.5">
      <PanicDeskSectionHeader
        icon="📈"
        title="패닉지수 히스토리"
        description="9대 패닉지수 원본 흐름 · 지표 선택 후 확인"
        tone="amber"
        tier="main"
      />
      <p className="m-0 panic-history-section__meta text-[11px] text-slate-500">
        원본 지표 데이터 · 매매 판단은 하단 실전 매매존
      </p>

      <div className="panic-history-picker" role="tablist" aria-label="9대 패닉지수">
        {PANIC_INDEX_HISTORY_ROWS.map((row, rowIdx) => (
          <div key={`picker-row-${rowIdx}`} className="panic-history-picker__row">
            {row.map((m) => {
              const n = metricCounts[m.key] ?? 0
              const active = activeMetricKey === m.key
              return (
                <button
                  key={m.key}
                  type="button"
                  role="tab"
                  onClick={() => setActiveMetricKey(m.key)}
                  className={[
                    "panic-history-picker__btn",
                    active ? "panic-history-picker__btn--active" : "",
                  ].join(" ")}
                  style={active ? { "--picker-accent": m.accent } : undefined}
                  title={m.tooltip ? `${m.tooltip} · ${n}일` : `${m.shortLabel} · ${n}일`}
                  aria-selected={active}
                >
                  <span className="panic-history-picker__btn-label">{m.shortLabel}</span>
                  <span className="panic-history-picker__btn-count font-mono">{n}</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <div className="panic-history-selection-bar">
        <p className="m-0 panic-history-selection-bar__selected">
          선택: <strong>{metric.shortLabel}</strong>
          <span className="panic-history-selection-bar__hint">{metric.tooltip}</span>
        </p>
        <div className="panic-history-selection-bar__ranges" role="group" aria-label="기간">
          {PANIC_INDEX_CHART_RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRangeId(r.id)}
              className={[
                "panic-history-range-btn font-mono tabular-nums",
                rangeId === r.id ? "panic-history-range-btn--active" : "",
              ].join(" ")}
              aria-pressed={rangeId === r.id}
            >
              {r.label}
            </button>
          ))}
        </div>
        <p className="m-0 panic-history-selection-bar__days text-[10px] text-slate-500">
          {rangeId} · {rangeStats.shown}일 표시
        </p>
      </div>

      <PanicHistoryInsightPanel
        header={insight.header}
        changeStrip={insight.changeStrip}
        interpretationLines={insight.interpretationLines}
        bottomInsight={insight.bottomInsight}
        metricKey={activeMetricKey}
        accent={metric.accent}
      />

      <div className="panic-history-section__chart mt-1 pb-1">
        {showChart ? (
          <PanicHistoryLineChart
            key={`panic-hist-${activeMetricKey}-${rangeId}`}
            rows={chartRowsSource}
            chartData={chartRows}
            dataKey={chartPayload?.dataKey ?? "value"}
            metricField={chartPayload?.selectedField ?? activeMetricKey}
            dataLabel={metric.chartLabel}
            stroke={metric.accent}
            showZoneBands={false}
            insightZones={false}
            connectNulls
            height={HISTORY_CHART_HEIGHT}
            emptyMessage={chartEmptyMessage}
          />
        ) : (
          <div className="flex h-[72px] items-center justify-center rounded border border-white/[0.06] bg-black/20 text-[10px] text-slate-500">
            {chartEmptyMessage}
          </div>
        )}
      </div>
    </section>
  )
}
