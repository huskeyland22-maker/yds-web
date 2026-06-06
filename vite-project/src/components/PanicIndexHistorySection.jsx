import { useEffect, useMemo, useState } from "react"
import { useAppDataStore } from "../store/appDataStore.js"
import { chartRangeStats, sliceHistoryByLabRange } from "../utils/chartRange.js"
import {
  PANIC_INDEX_CORE_HISTORY_METRICS,
  PANIC_INDEX_HISTORY_METRICS,
  YDS_COMPOSITE_HISTORY_METRIC,
} from "../utils/panicDeskMetrics.js"
import { mergeInflectionsIntoChartData } from "../utils/buildPanicHistoryInsight.js"
import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import { YDS_CYCLE_TAGLINE } from "../content/ydsCyclePhilosophy.js"
import YdsStagePositionNav from "./market-analysis/YdsStagePositionNav.jsx"
import { mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { buildHistoryChartPayload } from "../utils/panicHistoryChart.js"
import { countHistoryMetricPoints, resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import { resolvePanicHistoryUiState } from "../utils/panicHistoryUiState.js"
import { getFinalScore } from "../utils/tradingScores.js"
import { isPanicHubEnabled } from "../config/api.js"
import PanicHistoryLineChart from "./PanicHistoryLineChart.jsx"
import YdsScoreBreakdownPanel from "./market-analysis/YdsScoreBreakdownPanel.jsx"

const HISTORY_CHART_HEIGHT = 200
const YDS_RANGE_OPTIONS = [
  { id: "1M", label: "30일" },
  { id: "3M", label: "3개월" },
  { id: "1Y", label: "1년" },
]

function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function pickPanicPayload(row) {
  if (!row || typeof row !== "object") return null
  if (row.panicData && typeof row.panicData === "object") return row.panicData
  return row
}

function formatMetricValue(key, value) {
  if (!Number.isFinite(value)) return "—"
  if (key === "fearGreed") return String(Math.round(value))
  if (key === "bofa") return value.toFixed(1)
  if (key === "vix") return value.toFixed(2)
  return value.toFixed(2)
}

/**
 * @param {{
 *   rows?: object[]
 *   defaultChartOpen?: boolean
 *   inlineChart?: boolean
 *   panicData?: object | null
 * }} props
 */
export default function PanicIndexHistorySection({
  rows: rowsProp = [],
  defaultChartOpen = false,
  inlineChart = false,
  panicData = null,
}) {
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

  const [rangeId, setRangeId] = useState("3M")
  const [chartOpen, setChartOpen] = useState(defaultChartOpen || inlineChart)
  const [expandedMetricKey, setExpandedMetricKey] = useState(/** @type {string | null} */ (null))

  const ydsMetric = YDS_COMPOSITE_HISTORY_METRIC
  const activeMetricKey = expandedMetricKey ?? "ydsComposite"

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

  const chartRows = useMemo(() => chartPayload?.chartData ?? [], [chartPayload?.chartData])

  const uiState = useMemo(
    () =>
      resolvePanicHistoryUiState({
        historyLength: history.length,
        panicV2Count: metricCounts.ydsComposite ?? 0,
        syncStatus: panicHistoryV2SyncStatus,
        hubEnabled: isPanicHubEnabled(),
      }),
    [history.length, metricCounts, panicHistoryV2SyncStatus],
  )

  const showHistoryLoading = history.length === 0
  const rangeStats = chartRangeStats(history, rangeId, "lab")
  const hasChartData = chartRows.length > 0 && chartRows.some((x) => x?.value != null)
  const showChart = !showHistoryLoading && hasChartData
  const chartUiExpanded = inlineChart || chartOpen

  const ydsSummary = useMemo(() => {
    const source = panicData ?? pickPanicPayload(history[history.length - 1])
    const scoreRaw = source ? getFinalScore(source) : NaN
    if (!Number.isFinite(scoreRaw)) return null
    const score = Math.round(scoreRaw)
    const stage = resolveMacroV1Status(score)
    const flow = (history ?? [])
      .slice(-4)
      .map((row) => getFinalScore(pickPanicPayload(row) ?? {}))
      .filter(Number.isFinite)
      .map((n) => Math.round(n))
    const prevScore =
      history.length >= 2 ? Math.round(getFinalScore(pickPanicPayload(history[history.length - 2]) ?? {})) : null
    return {
      score,
      scoreDisplay: `${score} / 100`,
      stageLabel: stage?.label ?? "—",
      stageEmoji: stage?.emoji ?? "⚪",
      trendLine: flow.length ? flow.join(" → ") : "—",
      delta: prevScore != null ? score - prevScore : 0,
      prevScore,
    }
  }, [history, panicData])

  const coreCards = useMemo(() => {
    const source = panicData ?? pickPanicPayload(history[history.length - 1])
    if (!source) return []
    return PANIC_INDEX_CORE_HISTORY_METRICS.map((m) => {
      const field = m.key === "fearGreed" ? "fearGreed" : m.key
      const value = toNum(source[field])
      return {
        key: m.key,
        label: m.shortLabel ?? m.chartLabel,
        accent: m.accent,
        value,
        display: formatMetricValue(m.key, value),
      }
    })
  }, [panicData, history])

  const allNineRows = useMemo(() => {
    const source = panicData ?? pickPanicPayload(history[history.length - 1])
    if (!source) return []
    return PANIC_INDEX_HISTORY_METRICS.map((m) => {
      const field = m.key
      let value = toNum(source[field])
      if (m.key === "fearGreed") value = toNum(source.fearGreed)
      if (m.key === "gsBullBear") value = toNum(source.gsBullBear ?? source.gsSentiment)
      if (m.key === "highYield") value = toNum(source.highYield ?? source.hyOas)
      return {
        key: m.key,
        label: m.shortLabel,
        tooltip: m.tooltip,
        accent: m.accent,
        display: formatMetricValue(m.key, value ?? NaN),
        count: metricCounts[m.key] ?? 0,
      }
    })
  }, [panicData, history, metricCounts])

  if (inlineChart) {
    return (
      <section className="panic-history-v2 trading-card-shell panic-v2-section overflow-hidden px-2 pb-2 sm:px-2.5">
        {ydsSummary ? (
          <div className="panic-history-v2__hero" aria-label="YDS 총점">
            <p className="panic-history-v2__hero-label">YDS 총점</p>
            <p className="panic-history-v2__hero-score font-mono tabular-nums">{ydsSummary.scoreDisplay}</p>
            <p className="panic-history-v2__hero-stage">
              {ydsSummary.stageEmoji} {ydsSummary.stageLabel}
            </p>
            <p className="panic-history-v2__hero-philosophy">{YDS_CYCLE_TAGLINE}</p>
            <YdsStagePositionNav score={ydsSummary.score} compact />
            <p className="panic-history-v2__hero-flow">
              최근 흐름 <span className="font-mono tabular-nums">{ydsSummary.trendLine}</span>
              {ydsSummary.prevScore != null ? (
                <span
                  className={[
                    "panic-history-v2__hero-delta",
                    ydsSummary.delta > 0 ? "is-up" : ydsSummary.delta < 0 ? "is-down" : "is-flat",
                  ].join(" ")}
                >
                  {ydsSummary.delta > 0 ? ` +${ydsSummary.delta}` : ydsSummary.delta < 0 ? ` ${ydsSummary.delta}` : ""}
                </span>
              ) : null}
            </p>
          </div>
        ) : (
          <p className="panic-history-v2__loading">YDS 총점 데이터 준비 중…</p>
        )}

        <div className="panic-history-v2__chart-block">
          <div className="panic-history-v2__chart-head">
            <p className="panic-history-v2__chart-title">YDS 총점 히스토리</p>
            <div className="panic-history-v2__ranges" role="group" aria-label="기간">
              {YDS_RANGE_OPTIONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRangeId(r.id)}
                  className={[
                    "panic-history-v2__range-btn font-mono tabular-nums",
                    rangeId === r.id ? "is-active" : "",
                  ].join(" ")}
                  aria-pressed={rangeId === r.id}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="panic-history-v2__chart">
            {showChart ? (
              <PanicHistoryLineChart
                key={`yds-hist-${rangeId}`}
                rows={chartRowsSource}
                chartData={chartRows}
                dataKey="value"
                metricField="ydsComposite"
                dataLabel={ydsMetric.chartLabel}
                stroke={ydsMetric.accent}
                showZoneBands
                insightZones={false}
                connectNulls
                height={HISTORY_CHART_HEIGHT}
                emptyMessage="YDS 총점 원본 데이터 준비중"
              />
            ) : (
              <div className="panic-history-v2__chart-empty">
                {showHistoryLoading ? (uiState.chartMessage ?? "데이터 준비중") : "YDS 총점 원본 데이터 준비중"}
              </div>
            )}
          </div>
          <p className="panic-history-v2__chart-meta font-mono tabular-nums">
            {rangeId} · {rangeStats.shown}일 표시
          </p>
        </div>

        <details className="panic-history-v2__breakdown">
          <summary>점수 산출 근거 · 지표별 기여도</summary>
          <YdsScoreBreakdownPanel panicData={panicData ?? pickPanicPayload(history[history.length - 1])} historyRows={history} />
        </details>

        {coreCards.length ? (
          <div className="panic-history-v2__core" aria-label="핵심지표">
            <p className="panic-history-v2__section-label">핵심지표</p>
            <div className="panic-history-v2__core-grid">
              {coreCards.map((card) => (
                <article key={card.key} className="panic-history-v2__core-card" style={{ "--card-accent": card.accent }}>
                  <p className="panic-history-v2__core-label">{card.label}</p>
                  <p className="panic-history-v2__core-value font-mono tabular-nums">{card.display}</p>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        <details className="panic-history-v2__all-nine">
          <summary>전체 9대 지표</summary>
          <div className="panic-history-v2__nine-grid">
            {allNineRows.map((row) => (
              <button
                key={row.key}
                type="button"
                className={[
                  "panic-history-v2__nine-btn",
                  expandedMetricKey === row.key ? "is-active" : "",
                ].join(" ")}
                style={{ "--nine-accent": row.accent }}
                onClick={() => setExpandedMetricKey((prev) => (prev === row.key ? null : row.key))}
              >
                <span className="panic-history-v2__nine-label">{row.label}</span>
                <span className="panic-history-v2__nine-value font-mono tabular-nums">{row.display}</span>
                <span className="panic-history-v2__nine-count font-mono">{row.count}일</span>
              </button>
            ))}
          </div>
          {expandedMetricKey && expandedMetricKey !== "ydsComposite" ? (
            <div className="panic-history-v2__nine-chart">
              <PanicHistoryLineChart
                key={`nine-${expandedMetricKey}-${rangeId}`}
                rows={chartRowsSource}
                chartData={buildHistoryChartPayload(chartRowsSource, expandedMetricKey).chartData ?? []}
                dataKey="value"
                metricField={expandedMetricKey}
                dataLabel={PANIC_INDEX_HISTORY_METRICS.find((m) => m.key === expandedMetricKey)?.chartLabel ?? expandedMetricKey}
                stroke={PANIC_INDEX_HISTORY_METRICS.find((m) => m.key === expandedMetricKey)?.accent ?? "#94a3b8"}
                showZoneBands={false}
                connectNulls
                height={160}
                emptyMessage="원본 데이터 준비중"
              />
            </div>
          ) : null}
        </details>
      </section>
    )
  }

  return (
    <section className="panic-history-section trading-card-shell panic-v2-section overflow-hidden px-2 pb-2 sm:px-2.5">
      <div className="panic-history-compact-summary" role="status">
        <p className="m-0 panic-history-compact-summary__line">
          {ydsSummary
            ? `YDS 총점 ${ydsSummary.score}점 · ${ydsSummary.stageLabel} · 최근 ${ydsSummary.trendLine}`
            : "YDS 총점 — · 데이터 준비 중"}
        </p>
        <button
          type="button"
          className="panic-history-compact-summary__toggle"
          onClick={() => setChartOpen((v) => !v)}
        >
          {chartOpen ? "차트 닫기 ▲" : "차트 보기 ▼"}
        </button>
      </div>

      {chartUiExpanded && ydsSummary ? (
        <div className="panic-history-yds-summary" role="status" aria-label="YDS 총점 요약">
          <p className="m-0 panic-history-yds-summary__score">
            YDS 총점 {ydsSummary.score}점
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
        </div>
      ) : null}

      {chartUiExpanded ? (
        <div className="panic-history-section__chart mt-1 pb-1">
          {showChart ? (
            <PanicHistoryLineChart
              key={`panic-hist-yds-${rangeId}`}
              rows={chartRowsSource}
              chartData={chartRows}
              dataKey="value"
              metricField="ydsComposite"
              dataLabel={ydsMetric.chartLabel}
              stroke={ydsMetric.accent}
              showZoneBands
              connectNulls
              height={HISTORY_CHART_HEIGHT}
              emptyMessage="YDS 총점 원본 데이터 준비중"
            />
          ) : (
            <div className="flex h-[72px] items-center justify-center rounded border border-white/[0.06] bg-black/20 text-[10px] text-slate-500">
              {showHistoryLoading ? (uiState.chartMessage ?? "데이터 준비중") : "YDS 총점 원본 데이터 준비중"}
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}
