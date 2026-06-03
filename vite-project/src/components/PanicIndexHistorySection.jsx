import { useEffect, useMemo, useState } from "react"
import { useAppDataStore } from "../store/appDataStore.js"
import { chartRangeStats, PANIC_INDEX_CHART_RANGES, sliceHistoryByLabRange } from "../utils/chartRange.js"
import {
  PANIC_INDEX_CORE_HISTORY_METRICS,
  PANIC_INDEX_CORE_HISTORY_ROWS,
  PANIC_INDEX_HISTORY_METRICS,
  PANIC_INDEX_HISTORY_ROWS,
  YDS_COMPOSITE_HISTORY_METRIC,
} from "../utils/panicDeskMetrics.js"
import {
  buildPanicHistoryInsight,
  mergeInflectionsIntoChartData,
} from "../utils/buildPanicHistoryInsight.js"
import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import { mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { buildHistoryChartPayload } from "../utils/panicHistoryChart.js"
import { countHistoryMetricPoints, resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import { resolvePanicHistoryUiState } from "../utils/panicHistoryUiState.js"
import { getFinalScore } from "../utils/tradingScores.js"
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

  const [metricScope, setMetricScope] = useState(/** @type {"core" | "yds" | "all"} */ ("core"))
  const [activeMetricKey, setActiveMetricKey] = useState(DEFAULT_METRIC_KEY)
  const [rangeId, setRangeId] = useState("3M")
  const [chartOpen, setChartOpen] = useState(false)

  const scopeRows =
    metricScope === "core"
      ? PANIC_INDEX_CORE_HISTORY_ROWS
      : metricScope === "yds"
        ? [[YDS_COMPOSITE_HISTORY_METRIC]]
        : PANIC_INDEX_HISTORY_ROWS
  const scopeMetrics =
    metricScope === "core"
      ? PANIC_INDEX_CORE_HISTORY_METRICS
      : metricScope === "yds"
        ? [YDS_COMPOSITE_HISTORY_METRIC]
        : PANIC_INDEX_HISTORY_METRICS

  useEffect(() => {
    if (metricScope === "yds") {
      setActiveMetricKey("ydsComposite")
      return
    }
    if (scopeMetrics.some((m) => m.key === activeMetricKey)) return
    setActiveMetricKey(scopeMetrics[0]?.key ?? DEFAULT_METRIC_KEY)
  }, [metricScope, scopeMetrics, activeMetricKey])

  const metric = useMemo(() => {
    const found = scopeMetrics.find((m) => m.key === activeMetricKey)
    return found ?? scopeMetrics[0] ?? PANIC_INDEX_HISTORY_METRICS[0]
  }, [activeMetricKey, scopeMetrics])

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
  const ydsSummary = useMemo(() => {
    const rows = buildHistoryChartPayload(history, "ydsComposite").chartData ?? []
    const latest = rows[rows.length - 1]
    const latestScore = Number(latest?.value)
    if (!Number.isFinite(latestScore)) return null
    const stage = resolveMacroV1Status(latestScore)
    const latestRaw = history[history.length - 1]
    const flow = rows
      .slice(-4)
      .map((r) => Math.round(Number(r?.value)))
      .filter(Number.isFinite)
    return {
      score: Math.round(latestScore),
      stageLabel: stage?.label ?? "—",
      stageEmoji: stage?.emoji ?? "⚪",
      trendLine: flow.length ? flow.join(" → ") : "—",
      delta:
        history.length >= 2
          ? Math.round(getFinalScore(history[history.length - 1]) - getFinalScore(history[history.length - 2]))
          : 0,
      dateLabel: latestRaw?.date ?? "—",
    }
  }, [history])
  const compactLine = useMemo(() => {
    if (!ydsSummary) return "시장 위치 — · 데이터 준비 중"
    const latest = history[history.length - 1]
    const prev = history.length >= 2 ? history[history.length - 2] : null
    const vixNow = Number(latest?.vix)
    const vixPrev = Number(prev?.vix)
    let vixLine = "VIX 확인중"
    if (Number.isFinite(vixNow) && Number.isFinite(vixPrev)) {
      const delta = vixNow - vixPrev
      if (Math.abs(delta) < 0.2) vixLine = "VIX 변화 없음"
      else if (delta < 0) vixLine = "VIX 안정"
      else vixLine = "VIX 상승"
    }
    return `시장 위치 ${ydsSummary.score}점 · ${ydsSummary.stageLabel} · 최근 ${ydsSummary.trendLine} · ${vixLine}`
  }, [ydsSummary, history])

  return (
    <section
      className={[
        "panic-history-section",
        "trading-card-shell",
        "panic-v2-section",
        "overflow-hidden",
        "px-2",
        "pb-2",
        "sm:px-2.5",
        metricScope === "core" ? "panic-history-section--core" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <PanicDeskSectionHeader
        icon="📈"
        title="패닉지수 히스토리 요약 모드"
        description="요약 우선 · 차트는 필요 시 펼쳐보기"
        tone="amber"
        tier="main"
      />
      <div className="panic-history-compact-summary" role="status" aria-label="패닉지수 히스토리 요약">
        <p className="m-0 panic-history-compact-summary__line">{compactLine}</p>
        <button
          type="button"
          className="panic-history-compact-summary__toggle"
          onClick={() => setChartOpen((v) => !v)}
        >
          {chartOpen ? "차트 닫기 ▲" : "차트 보기 ▼"}
        </button>
      </div>
      {chartOpen ? <div className="panic-history-scope-toggle" role="tablist" aria-label="지표 범위">
        <button
          type="button"
          role="tab"
          className={["panic-history-scope-toggle__btn", metricScope === "core" ? "is-active" : ""].join(" ")}
          aria-selected={metricScope === "core"}
          onClick={() => setMetricScope("core")}
        >
          <span className="panic-history-scope-toggle__label-full">핵심 3지표</span>
          <span className="panic-history-scope-toggle__label-short">핵심</span>
        </button>
        <button
          type="button"
          role="tab"
          className={["panic-history-scope-toggle__btn", metricScope === "yds" ? "is-active" : ""].join(" ")}
          aria-selected={metricScope === "yds"}
          onClick={() => setMetricScope("yds")}
        >
          <span className="panic-history-scope-toggle__label-full">시장 위치</span>
          <span className="panic-history-scope-toggle__label-short">위치</span>
        </button>
        <button
          type="button"
          role="tab"
          className={["panic-history-scope-toggle__btn", metricScope === "all" ? "is-active" : ""].join(" ")}
          aria-selected={metricScope === "all"}
          onClick={() => setMetricScope("all")}
        >
          <span className="panic-history-scope-toggle__label-full">전체 9지표</span>
          <span className="panic-history-scope-toggle__label-short">전체</span>
        </button>
      </div> : null}

      {chartOpen ? <div className="panic-history-picker" role="tablist" aria-label={metricScope === "core" ? "핵심 3지표" : "9대 패닉지수"}>
        {scopeRows.map((row, rowIdx) => (
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
      </div> : null}

      {chartOpen ? <div className="panic-history-selection-bar">
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
      </div> : null}
      {ydsSummary && chartOpen ? (
        <div className="panic-history-yds-summary" role="status" aria-label="시장 위치 요약">
          <p className="m-0 panic-history-yds-summary__score">
            시장 위치 {ydsSummary.score}점
            <span
              className={[
                "panic-history-yds-summary__delta",
                ydsSummary.delta > 0 ? "is-up" : ydsSummary.delta < 0 ? "is-down" : "is-flat",
              ].join(" ")}
            >
              {ydsSummary.delta > 0 ? `+${ydsSummary.delta}` : ydsSummary.delta}
            </span>
          </p>
          <p className="m-0 panic-history-yds-summary__stage">
            {ydsSummary.stageEmoji} {ydsSummary.stageLabel}
          </p>
          <p className="m-0 panic-history-yds-summary__trend">최근 흐름 {ydsSummary.trendLine}</p>
          <p className="m-0 panic-history-yds-summary__date">{ydsSummary.dateLabel}</p>
        </div>
      ) : null}

      {chartOpen ? <PanicHistoryInsightPanel
        header={insight.header}
        changeStrip={insight.changeStrip}
        interpretationLines={insight.interpretationLines}
        bottomInsight={insight.bottomInsight}
        metricKey={activeMetricKey}
        accent={metric.accent}
      /> : null}

      {chartOpen ? <div className="panic-history-section__chart mt-1 pb-1">
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
      </div> : null}
    </section>
  )
}
