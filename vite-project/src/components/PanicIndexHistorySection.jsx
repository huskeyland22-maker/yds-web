import { useEffect, useMemo, useState } from "react"
import { useAppDataStore } from "../store/appDataStore.js"
import {
  buildMacroRegimeLog,
  enrichChartDataWithMacroRegime,
  markMacroRegimeChangePoints,
} from "../panic-v2/panicMacroRegimeHistory.js"
import { resolveMacroRegime } from "../panic-v2/panicMacroRegime.js"
import { buildTacticalTradeEventLog, attachTradeEventsToChartData } from "../panic-v2/panicTacticalTradeEvents.js"
import { panicV1ScoreForRow } from "../panic-v2/panicV1History.js"
import { chartRangeStats, LAB_CHART_RANGES, sliceHistoryByLabRange } from "../utils/chartRange.js"
import {
  HISTORY_AUX_METRICS,
  HISTORY_TAB_METRICS,
  PANIC_V1_HISTORY_TAB,
  PANIC_V2_HISTORY_TAB,
} from "../utils/panicDeskMetrics.js"
import { historyZoneLegendItems } from "../utils/panicHistoryLegend.js"
import {
  buildPanicHistoryInsight,
  mergeInflectionsIntoChartData,
} from "../utils/buildPanicHistoryInsight.js"
import { mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { buildHistoryChartPayload } from "../utils/panicHistoryChart.js"
import { PANIC_V2_CHART_DETAIL_METRICS } from "../panic-v2/weights.js"
import { countHistoryMetricPoints, resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import {
  buildPanicV2ChartData,
  resolveLatestPanicV2HistoryScore,
} from "../panic-v2/panicV2LatestScore.js"
import { resolvePanicV2Status } from "../panic-v2/panicV2Status.js"
import { resolvePanicHistoryUiState } from "../utils/panicHistoryUiState.js"
import { sortHistoryRowsAsc } from "../utils/panicHistoryDesk.js"
import { countPanicV2ScoredRows } from "../utils/panicHistoryV2Merge.js"
import { isPanicHubEnabled } from "../config/api.js"
import PanicHistoryInsightPanel from "./panic-history/PanicHistoryInsightPanel.jsx"
import PanicChartEventStrip from "./panic-history/PanicChartEventStrip.jsx"
import PanicEngineHistoryLog from "./panic-history/PanicEngineHistoryLog.jsx"
import PanicHistoryLineChart from "./PanicHistoryLineChart.jsx"

const HISTORY_CHART_HEIGHT = 220

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

  const [activeHistoryTab, setActiveHistoryTab] = useState("panicV2")
  const [rangeId, setRangeId] = useState("6M")
  const [v2DetailMetric, setV2DetailMetric] = useState(null)
  const [auxMetricsOpen, setAuxMetricsOpen] = useState(false)

  const isPanicScoreTab = activeHistoryTab === "panicV2" || activeHistoryTab === "panicV1"
  const isAuxHistoryTab = HISTORY_AUX_METRICS.some((m) => m.key === activeHistoryTab)

  const toggleAuxMetrics = () => {
    setAuxMetricsOpen((open) => {
      const next = !open
      if (!next && isAuxHistoryTab) {
        setActiveHistoryTab("panicV2")
        setV2DetailMetric(null)
      }
      return next
    })
  }

  const metric = useMemo(
    () => HISTORY_TAB_METRICS.find((m) => m.key === activeHistoryTab) ?? PANIC_V2_HISTORY_TAB,
    [activeHistoryTab],
  )

  const slicedRows = useMemo(() => sliceHistoryByLabRange(history, rangeId), [history, rangeId])
  const chartRowsSource = slicedRows.length ? slicedRows : history

  const metricCounts = useMemo(() => {
    const counts = {}
    for (const m of HISTORY_TAB_METRICS) {
      counts[m.key] = countHistoryMetricPoints(history, m.key)
    }
    return counts
  }, [history])

  const chartPayload = useMemo(
    () =>
      activeHistoryTab === "panicV2" && v2DetailMetric
        ? buildHistoryChartPayload(chartRowsSource, v2DetailMetric)
        : buildHistoryChartPayload(chartRowsSource, activeHistoryTab),
    [chartRowsSource, activeHistoryTab, v2DetailMetric],
  )

  const chartMetric = useMemo(() => {
    if (activeHistoryTab === "panicV2" && v2DetailMetric) {
      return PANIC_V2_CHART_DETAIL_METRICS.find((m) => m.key === v2DetailMetric) ?? metric
    }
    return metric
  }, [activeHistoryTab, v2DetailMetric, metric])

  const insight = useMemo(
    () => buildPanicHistoryInsight(chartRowsSource, history, activeHistoryTab),
    [chartRowsSource, history, activeHistoryTab],
  )

  const macroRegimeLog = useMemo(
    () => (activeHistoryTab === "panicV1" ? buildMacroRegimeLog(chartRowsSource, { maxEntries: 10 }) : []),
    [chartRowsSource, activeHistoryTab],
  )

  const tacticalEventLog = useMemo(
    () =>
      activeHistoryTab === "panicV2" && !v2DetailMetric
        ? buildTacticalTradeEventLog(chartRowsSource, { maxEntries: 10 })
        : [],
    [chartRowsSource, activeHistoryTab, v2DetailMetric],
  )

  const zoneLegend = useMemo(() => historyZoneLegendItems(activeHistoryTab), [activeHistoryTab])

  const panicV2ChartData = useMemo(
    () => buildPanicV2ChartData(chartRowsSource),
    [chartRowsSource],
  )

  const latestHistoryScore = useMemo(() => resolveLatestPanicV2HistoryScore(history), [history])
  const currentPanicV2Score = latestHistoryScore ?? 0

  useEffect(() => {
    console.log("[V2 CHART]", latestHistoryScore)
  }, [latestHistoryScore])

  const chartRows = useMemo(() => {
    let base =
      activeHistoryTab === "panicV2"
        ? v2DetailMetric
          ? (chartPayload?.chartData ?? [])
          : panicV2ChartData
        : (chartPayload?.chartData ?? [])

    if (activeHistoryTab === "panicV1" && base.length) {
      base = markMacroRegimeChangePoints(enrichChartDataWithMacroRegime(base), macroRegimeLog)
    } else if (activeHistoryTab === "panicV2" && !v2DetailMetric && base.length) {
      base = attachTradeEventsToChartData(tacticalEventLog, base)
    } else if (activeHistoryTab !== "panicV2" || v2DetailMetric) {
      const inflections = insight.inflections
      base = mergeInflectionsIntoChartData(base, inflections)
    }

    return base
  }, [
    activeHistoryTab,
    v2DetailMetric,
    panicV2ChartData,
    chartPayload?.chartData,
    insight.inflections,
    macroRegimeLog,
    tacticalEventLog,
  ])

  const latestV1Score = useMemo(() => {
    if (!history.length) return null
    const last = [...history].reverse().find((r) => panicV1ScoreForRow(r) != null)
    return last ? panicV1ScoreForRow(last) : null
  }, [history])

  const currentMacroRegime = useMemo(() => resolveMacroRegime(latestV1Score), [latestV1Score])

  const panicV2Count = useMemo(() => countPanicV2ScoredRows(history), [history])

  const uiState = useMemo(
    () =>
      resolvePanicHistoryUiState({
        historyLength: history.length,
        panicV2Count: activeHistoryTab === "panicV2" ? panicV2Count : metricCounts.panicV2 ?? 0,
        syncStatus: panicHistoryV2SyncStatus,
        hubEnabled: isPanicHubEnabled(),
      }),
    [history.length, panicV2Count, activeHistoryTab, metricCounts.panicV2, panicHistoryV2SyncStatus],
  )

  const headerCurrentText =
    activeHistoryTab === "panicV2"
      ? history.length > 0
        ? String(currentPanicV2Score)
        : "데이터 준비중"
      : activeHistoryTab === "panicV1"
        ? latestV1Score != null
          ? String(latestV1Score)
          : "데이터 준비중"
        : uiState.currentText ??
          (insight.header.currentText === "—" ? "데이터 준비중" : insight.header.currentText)
  const latestTacticalEvent = tacticalEventLog.length ? tacticalEventLog[tacticalEventLog.length - 1] : null

  const headerStatusLabel =
    activeHistoryTab === "panicV2"
      ? (latestTacticalEvent?.eventLabel ?? resolvePanicV2Status(currentPanicV2Score)?.label ?? "—")
      : activeHistoryTab === "panicV1"
        ? (currentMacroRegime?.label ?? "—")
        : uiState.statusLabel ??
          (insight.header.statusLabel === "—" ? "준비중" : insight.header.statusLabel)

  const headerStatusPrefix =
    activeHistoryTab === "panicV1" ? "현재" : activeHistoryTab === "panicV2" ? "상태" : null

  const showHistoryLoading = history.length === 0
  const showChart =
    activeHistoryTab === "panicV2"
      ? !showHistoryLoading && panicV2ChartData.some((x) => x.value != null)
      : uiState.showChart && chartRows.length > 0

  return (
    <section className="panic-history-section trading-card-shell panic-v2-section overflow-hidden px-2 pb-2 sm:px-2.5">
      <div className="panic-history-section__head border-l-2 border-cyan-400/45 pl-2">
        <p className="m-0 text-[11px] font-bold text-slate-100">시장 엔진 히스토리</p>
        <p className="m-0 text-[9px] text-slate-500">
          거시 V1 = 시장 국면 변화 · 실전 V2 = 매매 이벤트 기록
          {activeHistoryTab !== "panicV1" && activeHistoryTab !== "panicV2" ? ` · ${metric.label}` : ""} ·{" "}
          {rangeId} · {chartRangeStats(history, rangeId, "lab").shown}일
        </p>
      </div>

      <div className="panic-history-tabs mt-1.5 flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => {
            setActiveHistoryTab("panicV2")
            setV2DetailMetric(null)
          }}
          title={PANIC_V2_HISTORY_TAB.tooltip}
          className={[
            "panic-history-tab panic-history-tab--main inline-flex items-center gap-0.5",
            activeHistoryTab === "panicV2"
              ? "border-orange-400/35 bg-orange-500/15 text-orange-50 ring-1 ring-orange-400/25"
              : "border-transparent text-slate-400",
          ].join(" ")}
          aria-pressed={activeHistoryTab === "panicV2"}
        >
          <span className="panic-history-tab__label">{PANIC_V2_HISTORY_TAB.label}</span>
          <span className="text-[7px] font-bold uppercase tracking-wide opacity-80">
            {PANIC_V2_HISTORY_TAB.badge}
          </span>
          <span className="panic-history-tab__count font-mono text-[8px] opacity-75">
            {metricCounts.panicV2 ?? 0}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveHistoryTab("panicV1")}
          title={PANIC_V1_HISTORY_TAB.tooltip}
          className={[
            "panic-history-tab panic-history-tab--main inline-flex items-center gap-0.5",
            activeHistoryTab === "panicV1"
              ? "border-cyan-400/35 bg-cyan-500/15 text-cyan-50 ring-1 ring-cyan-400/25"
              : "border-transparent text-slate-500",
          ].join(" ")}
          aria-pressed={activeHistoryTab === "panicV1"}
        >
          <span className="panic-history-tab__label">{PANIC_V1_HISTORY_TAB.label}</span>
          <span className="text-[7px] font-bold uppercase tracking-wide opacity-80">
            {PANIC_V1_HISTORY_TAB.badge}
          </span>
          <span className="panic-history-tab__count font-mono text-[8px] opacity-75">
            {metricCounts.panicV1 ?? 0}
          </span>
        </button>
        <button
          type="button"
          onClick={toggleAuxMetrics}
          className={[
            "panic-history-tab panic-history-tab--aux-toggle inline-flex max-w-full items-center rounded-md border px-1.5 py-0.5",
            auxMetricsOpen
              ? "border-sky-400/25 bg-sky-500/10 text-sky-100"
              : "border-transparent bg-transparent text-slate-500 hover:text-slate-300",
          ].join(" ")}
          aria-expanded={auxMetricsOpen}
          aria-controls="panic-history-aux-tabs"
        >
          <span className="panic-history-tab__label whitespace-nowrap text-[9px] font-semibold">
            {auxMetricsOpen ? "보조지표 −" : "보조지표 +"}
          </span>
        </button>
        {auxMetricsOpen ? (
          <span id="panic-history-aux-tabs" className="contents">
            {HISTORY_AUX_METRICS.map((m) => {
              const n = metricCounts[m.key] ?? 0
              const active = activeHistoryTab === m.key
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setActiveHistoryTab(m.key)}
                  className={[
                    "panic-history-tab panic-history-tab--aux inline-flex max-w-full items-center gap-0.5 rounded-md border px-1.5 py-0.5",
                    active
                      ? "border-white/20 bg-white/10 text-slate-100"
                      : "border-transparent bg-transparent text-slate-500 hover:text-slate-300",
                  ].join(" ")}
                  title={m.tooltip ? `${m.label} · ${n}일` : `${m.label} · ${n}일`}
                  aria-pressed={active}
                >
                  <span className="panic-history-tab__label whitespace-nowrap text-[9px]">{m.label}</span>
                </button>
              )
            })}
          </span>
        ) : null}
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
            >
              {r.label}
            </button>
          )
        })}
      </div>

      {activeHistoryTab === "panicV1" && macroRegimeLog.length > 0 ? (
        <PanicEngineHistoryLog
          title="시장 국면 변화"
          entries={macroRegimeLog.map((e) => ({
            axisLabel: e.axisLabel,
            primary: e.regimeLabel,
            toneId: e.regimeId,
          }))}
        />
      ) : null}

      {activeHistoryTab === "panicV2" && !v2DetailMetric && tacticalEventLog.length > 0 ? (
        <PanicEngineHistoryLog
          title="매매 이벤트 기록"
          entries={tacticalEventLog.map((e) => ({
            axisLabel: e.axisLabel,
            primary: e.eventLabel,
            secondary: e.reason,
            toneId: e.eventId,
          }))}
        />
      ) : null}

      {isPanicScoreTab ? (
        <div className="panic-history-v2-compact mt-1.5 flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/[0.06] bg-black/25 px-2 py-1.5">
          <div>
            <span className="text-[8px] font-semibold uppercase text-slate-500">현재</span>
            <p className="m-0 font-mono text-[18px] font-bold tabular-nums text-cyan-100">
              {headerCurrentText}
            </p>
          </div>
          <span
            className={[
              "rounded-full border px-2 py-0.5 text-[10px] font-bold",
              activeHistoryTab === "panicV1"
                ? "panic-history-status-badge--macro"
                : "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
            ].join(" ")}
          >
            {headerStatusPrefix ? `${headerStatusPrefix}: ` : ""}
            {headerStatusLabel}
          </span>
        </div>
      ) : (
        <PanicHistoryInsightPanel
          header={insight.header}
          changeStrip={insight.changeStrip}
          interpretationLines={insight.interpretationLines}
          bottomInsight={insight.bottomInsight}
          metricKey={activeHistoryTab}
          accent={metric.accent}
        />
      )}

      {zoneLegend.length > 0 && isPanicScoreTab ? (
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

      <div className="panic-history-section__chart mt-1 pb-1">
        {showChart ? (
          <PanicHistoryLineChart
            key={`panic-hist-${activeHistoryTab}-${rangeId}-${v2DetailMetric ?? "score"}`}
            rows={chartRowsSource}
            chartData={chartRows}
            dataKey={chartPayload?.dataKey ?? "value"}
            metricField={chartPayload?.selectedField ?? activeHistoryTab}
            dataLabel={chartMetric.chartLabel}
            stroke={chartMetric.accent}
            showZoneBands={false}
            insightZones={isPanicScoreTab && !v2DetailMetric}
            connectNulls={activeHistoryTab !== "panicV2"}
            height={HISTORY_CHART_HEIGHT}
          />
        ) : (
          <div className="flex h-[72px] items-center justify-center rounded border border-white/[0.06] bg-black/20 text-[10px] text-slate-500">
            {showHistoryLoading ? "데이터 준비중" : (uiState.chartMessage ?? "데이터 준비중")}
          </div>
        )}
      </div>

      {activeHistoryTab === "panicV2" && !v2DetailMetric && showChart && tacticalEventLog.length > 0 ? (
        <PanicChartEventStrip events={tacticalEventLog} />
      ) : null}

      {activeHistoryTab === "panicV2" && showChart ? (
        <div className="mt-0.5 flex flex-wrap gap-0.5" role="group" aria-label="V2 보조 지표">
          <button
            type="button"
            onClick={() => setV2DetailMetric(null)}
            className={[
              "rounded px-1.5 py-0.5 font-mono text-[9px] tabular-nums",
              !v2DetailMetric ? "bg-cyan-500/15 text-cyan-100" : "text-slate-600",
            ].join(" ")}
          >
            점수
          </button>
          {PANIC_V2_CHART_DETAIL_METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setV2DetailMetric(m.key)}
              className={[
                "rounded px-1.5 py-0.5 font-mono text-[9px] tabular-nums",
                v2DetailMetric === m.key ? "bg-cyan-500/15 text-cyan-100" : "text-slate-600",
              ].join(" ")}
            >
              {m.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}
