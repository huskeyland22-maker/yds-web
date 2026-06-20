import { useEffect, useMemo, useState } from "react"
import { chartRangeStats, LAB_CHART_RANGES, sliceHistoryByLabRange } from "../utils/chartRange.js"
import { HISTORY_SECTION_METRICS } from "../utils/panicDeskMetrics.js"
import {
  buildPanicLabChartData,
  latestLabSnapshot,
  resolvePanicMarketStage,
} from "../utils/panicHistoryLab.js"
import {
  computeHistoryMetricStats,
  formatHistoryChangePct,
  historyChangeToneClass,
  historyValuesForMetric,
  HIGHER_IS_BAD,
} from "../utils/panicHistoryStats.js"
import { formatMetricValue } from "./macroCycleChartUtils.js"
import PanicHistoryLabChart from "./PanicHistoryLabChart.jsx"
import PanicHistoryLineChart from "./PanicHistoryLineChart.jsx"

const CHART_HEIGHT_DESKTOP = 300
const CHART_HEIGHT_MOBILE = 280
const EMPTY_HISTORY_HEIGHT = 80

const HISTORY_TABS = [
  { id: "composite", label: "복합", key: null },
  ...HISTORY_SECTION_METRICS.map((m) => ({ id: m.key, label: m.label, key: m.key })),
]

function useIsMobile() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)")
    const fn = () => setMobile(mq.matches)
    fn()
    mq.addEventListener("change", fn)
    return () => mq.removeEventListener("change", fn)
  }, [])
  return mobile
}

/** @param {object[]} rows @param {string | null} metricKey */
function compactStats(rows, metricKey, labData) {
  if (metricKey === null) {
    const vals = (labData ?? [])
      .map((d) => d.composite)
      .filter((v) => typeof v === "number" && Number.isFinite(v))
    if (!vals.length) {
      return { current: "—", avg: "—", high: "—", change: "—", status: "—", changeClass: "" }
    }
    const current = vals[vals.length - 1]
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length
    const high = Math.max(...vals)
    const prev = vals.length > 1 ? vals[vals.length - 2] : null
    const chg =
      prev != null && prev !== 0 ? ((current - prev) / Math.abs(prev)) * 100 : null
    const stage = resolvePanicMarketStage(current)
    return {
      current: String(Math.round(current)),
      avg: String(Math.round(avg)),
      high: String(Math.round(high)),
      change: formatHistoryChangePct(chg),
      status: stage.label,
      changeClass: historyChangeToneClass(chg, true, false),
    }
  }

  const stats = computeHistoryMetricStats(rows, metricKey)
  const values = historyValuesForMetric(rows, metricKey)
  const avg =
    values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null

  return {
    current: stats.currentText,
    avg: avg != null ? formatMetricValue(metricKey, avg) : "—",
    high: stats.highText,
    change: stats.dayText,
    status: stats.statusLabel,
    changeClass: historyChangeToneClass(
      stats.dayPct,
      HIGHER_IS_BAD[metricKey] ?? true,
      stats.dayPending,
    ),
  }
}

/** @param {{ rows?: object[] }} props */
export default function PanicUnifiedHistorySection({ rows = [] }) {
  const [tabId, setTabId] = useState("composite")
  const [rangeId, setRangeId] = useState("6M")
  const [mobileDetail, setMobileDetail] = useState(false)
  const [compositeYScale, setCompositeYScale] = useState("auto")
  const isMobile = useIsMobile()

  const chartHeight = isMobile ? CHART_HEIGHT_MOBILE : CHART_HEIGHT_DESKTOP

  const slicedRows = useMemo(() => sliceHistoryByLabRange(rows, rangeId), [rows, rangeId])

  const rangeStats = useMemo(() => chartRangeStats(rows, rangeId, "lab"), [rows, rangeId])

  const labData = useMemo(() => {
    try {
      return buildPanicLabChartData(slicedRows)
    } catch {
      return []
    }
  }, [slicedRows])

  const activeTab = HISTORY_TABS.find((t) => t.id === tabId) ?? HISTORY_TABS[0]
  const metricKey = activeTab.key
  const metricMeta = metricKey
    ? HISTORY_SECTION_METRICS.find((m) => m.key === metricKey)
    : null

  const stats = useMemo(
    () => compactStats(slicedRows, metricKey, labData),
    [slicedRows, metricKey, labData],
  )

  const latest = useMemo(() => (tabId === "composite" ? latestLabSnapshot(labData) : null), [tabId, labData])

  const visibleKeys = useMemo(
    () => ({
      composite: tabId === "composite",
      vix: false,
      fearGreed: false,
      putCall: false,
      bofa: false,
      highYield: false,
      move: false,
      skew: false,
    }),
    [tabId],
  )

  const defaultWindow = useMemo(() => {
    const preset = LAB_CHART_RANGES.find((r) => r.id === rangeId)
    return preset?.days ?? labData.length
  }, [rangeId, labData.length])

  const hasHistory = Array.isArray(rows) && rows.length > 0
  const hasChart = tabId === "composite" ? labData.length > 0 : slicedRows.length > 0

  const tabsToShow =
    isMobile && !mobileDetail
      ? HISTORY_TABS.filter((t) => t.id === "composite")
      : HISTORY_TABS

  if (!hasHistory) {
    return (
      <section className="trading-card-shell panic-v2-section px-2 py-1 sm:px-2.5">
        <p className="m-0 text-[11px] font-bold text-slate-100">패닉 히스토리</p>
        <div
          className="mt-1.5 flex flex-col items-center justify-center rounded border border-white/[0.06] bg-black/20 text-center"
          style={{ height: EMPTY_HISTORY_HEIGHT }}
        >
          <p className="m-0 text-[10px] font-semibold text-slate-300">📊 히스토리 수집중</p>
          <p className="m-0 mt-0.5 text-[9px] leading-snug text-slate-500">
            최근 3일 이상 데이터 누적시 표시
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="trading-card-shell panic-v2-section overflow-visible px-2 py-2 sm:px-2.5 sm:py-2">
      <div className="flex flex-wrap items-center justify-between gap-2 border-l-2 border-cyan-400/45 pl-2">
        <div>
          <p className="m-0 text-[11px] font-bold text-slate-100">패닉 히스토리</p>
          <p className="m-0 text-[9px] text-slate-500">
            통합 · 1M–ALL · 실제 {rangeStats.shown}/{rangeStats.total}일
          </p>
        </div>
        {isMobile ? (
          <button
            type="button"
            onClick={() => setMobileDetail((v) => !v)}
            className="rounded border border-white/10 px-2 py-0.5 text-[9px] font-medium text-cyan-200/90"
          >
            {mobileDetail ? "간단히" : "상세 열기"}
          </button>
        ) : null}
      </div>

      <div className="panic-history-tabs mt-2 flex flex-wrap gap-1">
        {tabsToShow.map((t) => {
          const active = tabId === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTabId(t.id)}
              className={[
                "panic-history-tab inline-flex max-w-full items-center rounded-md border px-1.5 py-1 transition",
                active
                  ? "border-white/20 bg-white/12 text-slate-50 ring-1 ring-white/12"
                  : "border-transparent bg-transparent text-slate-400 hover:border-white/10 hover:text-slate-200",
              ].join(" ")}
              aria-pressed={active}
            >
              <span className="panic-history-tab__label whitespace-nowrap">{t.label}</span>
            </button>
          )
        })}
      </div>

      {tabId === "composite" ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <span className="mr-1 text-[8px] text-slate-600">Y축</span>
          {[
            { id: "auto", label: "자동" },
            { id: "full", label: "0~100" },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setCompositeYScale(opt.id)}
              className={[
                "rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold tabular-nums",
                compositeYScale === opt.id
                  ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/30"
                  : "text-slate-500 hover:text-slate-300",
              ].join(" ")}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-1.5 flex flex-wrap gap-0.5">
        {LAB_CHART_RANGES.map((r) => {
          const st = chartRangeStats(rows, r.id, "lab")
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

      <div className="mt-2 grid grid-cols-5 gap-1">
        <MiniStat label="현재" value={stats.current} accent />
        <MiniStat label="평균" value={stats.avg} />
        <MiniStat label="최고" value={stats.high} />
        <MiniStat label="변화율" value={stats.change} valueClass={stats.changeClass} />
        <MiniStat label="상태" value={stats.status} />
      </div>

      {latest && tabId === "composite" ? (
        <p className="m-0 mt-1 text-[9px] text-slate-500">
          <span style={{ color: latest.stageColor }}>{latest.stageLabel}</span>
          {" · "}
          {latest.date}
        </p>
      ) : null}

      <div className="mt-2">
        {hasChart ? (
          tabId === "composite" ? (
            <PanicHistoryLabChart
              data={labData}
              visibleKeys={visibleKeys}
              defaultWindow={defaultWindow}
              height={chartHeight}
              compositeYScale={compositeYScale}
            />
          ) : (
            <PanicHistoryLineChart
              rows={slicedRows}
              dataKey={metricKey}
              dataLabel={metricMeta?.chartLabel ?? metricKey}
              stroke={metricMeta?.accent ?? "#94a3b8"}
              showZoneBands
              height={chartHeight}
              summary={null}
            />
          )
        ) : (
          <div
            className="flex items-center justify-center rounded border border-white/[0.06] bg-black/20 text-[10px] text-slate-500"
            style={{ height: chartHeight }}
          >
            구간 데이터 없음
          </div>
        )}
      </div>
    </section>
  )
}

/** @param {{ label: string; value: string; accent?: boolean; valueClass?: string }} props */
function MiniStat({ label, value, accent = false, valueClass = "" }) {
  return (
    <div className="rounded border border-white/[0.05] bg-black/25 px-1 py-1">
      <p className="m-0 text-[7px] font-semibold uppercase text-slate-600">{label}</p>
      <p
        className={[
          "m-0 mt-0.5 truncate font-mono text-[10px] font-bold tabular-nums leading-tight",
          accent ? "text-slate-50" : "text-slate-300",
          valueClass,
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  )
}
