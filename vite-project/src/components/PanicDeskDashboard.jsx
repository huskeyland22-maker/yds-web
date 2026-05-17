import { useEffect, useMemo, useState } from "react"
import { isPanicHubEnabled } from "../config/api.js"
import { useAppDataStore } from "../store/appDataStore.js"
import { getFinalScore, getMidScore, getShortScore } from "../utils/tradingScores.js"
import {
  ageMsFromUpdatedAt,
  formatAgeKo,
  formatDataBasisKst,
  kstCalendarKey,
  staleAgeAccentClassName,
  staleDisplayTier,
} from "../utils/formatDataAge.js"
import { CORE_METRICS, EXPERT_METRICS, findChartMetric } from "../utils/panicDeskMetrics.js"
import { moodPositionPct, resolveMarketMood } from "../utils/panicDeskMood.js"
import { formatMetricValue, metricValueDisplayStyle } from "./macroCycleChartUtils.js"
import PanicDeskChart from "./PanicDeskChart.jsx"

const MOOD_LABELS = ["극도 공포", "공포", "중립", "과열", "극도 과열"]

const CORE_CELL =
  "flex min-h-[4rem] flex-col items-center justify-center bg-[#070a10] px-1 py-2.5 transition-colors sm:min-h-[4.25rem] sm:py-3"

const CORE_LABEL =
  "max-w-full px-0.5 text-center text-[13px] font-semibold leading-snug tracking-[0.04em] text-slate-200 [text-wrap:balance]"

const CORE_VALUE =
  "mt-1 font-mono text-[1rem] font-bold leading-none tabular-nums sm:text-[1.1rem]"

const EXPERT_CELL =
  "flex min-h-[2.65rem] flex-col items-center justify-center bg-[#070a10]/70 px-0.5 py-1 transition-colors sm:min-h-[2.85rem] sm:py-1.5"

const EXPERT_LABEL =
  "max-w-full px-0.5 text-center text-[10px] font-medium leading-tight tracking-[0.02em] text-slate-500/90 [text-wrap:balance]"

const EXPERT_VALUE =
  "mt-0.5 font-mono text-[0.78rem] font-medium leading-none tabular-nums text-slate-400/85 sm:text-[0.85rem]"

function fmt(key, v) {
  if (v == null || !Number.isFinite(Number(v))) return "—"
  return formatMetricValue(key, Number(v))
}

/** @param {{ title: string; variant?: "core" | "expert" }} props */
function SectionLabel({ title, variant = "core" }) {
  const isExpert = variant === "expert"
  return (
    <div className={isExpert ? "mb-1 mt-5" : "mb-1.5 mt-1"}>
      <p
        className={[
          "m-0 border-l-2 pl-2 text-left text-[11px] font-bold tracking-[0.02em]",
          isExpert ? "border-slate-600/80 text-slate-500" : "border-cyan-400/50 text-slate-300",
        ].join(" ")}
      >
        {title}
      </p>
      <span
        className={["mt-1.5 block h-px w-full", isExpert ? "bg-white/[0.03]" : "bg-white/[0.08]"].join(" ")}
      />
    </div>
  )
}

/**
 * @param {{
 *   metric: import("../utils/panicDeskMetrics.js").PanicDeskMetric
 *   value: string
 *   selected: boolean
 *   onSelect: () => void
 *   variant?: "core" | "expert"
 * }} props
 */
function MetricTile({ metric, value, selected, onSelect, variant = "core" }) {
  const isExpert = variant === "expert"
  const selectedRing = isExpert ? "ring-1 ring-inset ring-white/[0.06]" : "ring-1 ring-inset ring-white/20"
  const valueStyle = isExpert
    ? { color: metric.accent, opacity: 0.82 }
    : metricValueDisplayStyle(metric.accent)
  return (
    <button
      type="button"
      title={metric.tooltip}
      aria-label={metric.tooltip ? `${metric.label}: ${metric.tooltip}` : metric.label}
      data-metric-tooltip={metric.tooltip ?? ""}
      onClick={onSelect}
      className={[
        isExpert ? EXPERT_CELL : CORE_CELL,
        selected
          ? selectedRing
          : isExpert
            ? "hover:bg-white/[0.008]"
            : "hover:bg-white/[0.05]",
      ].join(" ")}
    >
      <span className={isExpert ? EXPERT_LABEL : CORE_LABEL}>{metric.label}</span>
      <span className={isExpert ? EXPERT_VALUE : CORE_VALUE} style={valueStyle}>
        {value}
      </span>
    </button>
  )
}

/**
 * @param {{
 *   panicData: object | null
 *   cycleMetricHistory: object[]
 *   isStale?: boolean
 *   asOfDateLabel?: string
 *   tacticalView: { state: string; action: string }
 *   strategicView: { state: string; action: string }
 *   macroView: { state: string; action: string }
 *   marketState?: { headline?: string; stateKey?: string }
 * }} props
 */
export default function PanicDeskDashboard({
  panicData,
  cycleMetricHistory,
  isStale = false,
  asOfDateLabel = "—",
  tacticalView,
  strategicView,
  macroView,
  marketState,
}) {
  const [chartMetric, setChartMetric] = useState("vix")
  const deskMarketReport = useAppDataStore((s) => s.deskMarketReport)
  const deskMarketReportLoading = useAppDataStore((s) => s.deskMarketReportLoading)
  const loadDeskMarketReport = useAppDataStore((s) => s.loadDeskMarketReport)

  const mood = useMemo(() => resolveMarketMood(panicData?.fearGreed), [panicData?.fearGreed])
  const moodPct = useMemo(() => moodPositionPct(panicData?.fearGreed), [panicData?.fearGreed])

  const finalScore = useMemo(() => (panicData ? getFinalScore(panicData) : null), [panicData])
  const shortScore = useMemo(
    () => (panicData ? getShortScore(panicData.vix, panicData.putCall) : null),
    [panicData],
  )
  const midScore = useMemo(
    () => (panicData ? getMidScore(panicData.fearGreed, panicData.bofa, panicData.highYield) : null),
    [panicData],
  )

  const dataAgeMs = useMemo(() => {
    const metaAge = panicData?.__meta?.ageMs
    if (metaAge != null && Number.isFinite(Number(metaAge))) return Number(metaAge)
    return ageMsFromUpdatedAt(panicData?.updatedAt)
  }, [panicData])

  const todayKey = useMemo(() => kstCalendarKey(), [])
  const dataDateKey = useMemo(() => {
    if (asOfDateLabel && /^\d{4}-\d{2}-\d{2}$/.test(asOfDateLabel)) return asOfDateLabel
    if (panicData?.updatedAt) return kstCalendarKey(new Date(panicData.updatedAt))
    return asOfDateLabel
  }, [asOfDateLabel, panicData?.updatedAt])

  const basisDateTime = useMemo(() => formatDataBasisKst(panicData?.updatedAt), [panicData?.updatedAt])
  const basisStatusLine = useMemo(
    () => (basisDateTime ? `미국장 종가 기준 · ${basisDateTime}` : "미국장 종가 기준 · —"),
    [basisDateTime],
  )
  const ageKoLabel = useMemo(() => formatAgeKo(dataAgeMs), [dataAgeMs])
  const ageStatusLine = useMemo(
    () => (ageKoLabel ? `${ageKoLabel} 업데이트` : "— 업데이트"),
    [ageKoLabel],
  )
  const staleTier = useMemo(() => {
    if (isStale && staleDisplayTier(dataAgeMs) === "hidden") return "aging"
    return staleDisplayTier(dataAgeMs)
  }, [dataAgeMs, isStale])
  const ageAccentClass = useMemo(() => staleAgeAccentClassName(staleTier), [staleTier])
  const showCollectBanner =
    isStale ||
    (dataAgeMs != null && dataAgeMs >= 4 * 60 * 60 * 1000) ||
    (dataDateKey && dataDateKey !== todayKey)

  const horizons = useMemo(
    () => [
      {
        id: "short",
        tag: "단기",
        title: tacticalView?.state ?? "—",
        body: tacticalView?.action ?? "—",
        accent: "border-sky-500/25 bg-sky-500/[0.06]",
        score: shortScore,
      },
      {
        id: "mid",
        tag: "중기",
        title: strategicView?.state ?? "—",
        body: strategicView?.action ?? "—",
        accent: "border-violet-500/25 bg-violet-500/[0.06]",
        score: midScore,
      },
      {
        id: "long",
        tag: "장기",
        title: macroView?.state ?? "—",
        body: macroView?.action ?? "—",
        accent: "border-emerald-500/25 bg-emerald-500/[0.06]",
        score: finalScore,
      },
    ],
    [tacticalView, strategicView, macroView, shortScore, midScore, finalScore],
  )

  const chartSeries = useMemo(() => {
    const m = findChartMetric(chartMetric)
    return {
      key: chartMetric,
      name: m?.chartLabel ?? m?.label ?? chartMetric,
      color: m?.accent ?? "#94a3b8",
    }
  }, [chartMetric])

  useEffect(() => {
    if (!isPanicHubEnabled()) return
    const date =
      asOfDateLabel && /^\d{4}-\d{2}-\d{2}$/.test(asOfDateLabel)
        ? asOfDateLabel
        : dataDateKey && /^\d{4}-\d{2}-\d{2}$/.test(dataDateKey)
          ? dataDateKey
          : null
    if (date) void loadDeskMarketReport(date)
  }, [asOfDateLabel, dataDateKey, loadDeskMarketReport])

  return (
    <div className="relative space-y-2 lg:space-y-2.5">
      <div className="sticky top-0 z-20 -mx-0.5 flex justify-end border-b border-white/[0.04] bg-[#0B0E14]/90 px-1 py-0.5 backdrop-blur-sm">
        <div
          className="w-auto rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-right leading-tight"
          aria-label="데이터 기준 시각"
        >
          <p className="m-0 font-mono text-[12px] font-semibold tabular-nums text-slate-200">
            {basisStatusLine}
          </p>
          <p
            className={`m-0 mt-0.5 text-[10px] tabular-nums text-white/60 ${ageAccentClass}`}
          >
            {ageStatusLine}
          </p>
        </div>
      </div>

      {showCollectBanner ? (
        <div
          className="flex items-center gap-2 rounded-md border border-cyan-500/20 bg-cyan-500/[0.06] px-2 py-1"
          role="status"
        >
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-cyan-400/80" aria-hidden />
          <p className="m-0 text-[10px] font-medium text-cyan-100/85">다음 시장 데이터 수집 대기중</p>
        </div>
      ) : null}

      <section className="trading-card-shell overflow-hidden px-2.5 py-2 sm:px-3 sm:py-2.5">
        <div>
          <p className="m-0 text-[9px] font-semibold tracking-[0.16em] text-slate-500">MARKET MOOD</p>
          <p className="m-0 mt-0.5 text-[15px] font-semibold tracking-tight text-slate-50 sm:text-base">
            {mood.active ? mood.label : "동기화 대기"}
          </p>
        </div>

        <div className="relative mt-2.5">
          <div className="flex justify-between gap-0.5 text-[8px] font-medium tracking-tight text-slate-600 sm:text-[9px]">
            {MOOD_LABELS.map((l) => (
              <span key={l} className="flex-1 text-center">
                {l}
              </span>
            ))}
          </div>
          <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="absolute inset-y-0 left-0 rounded-full opacity-90"
              style={{
                width: `${moodPct}%`,
                background:
                  "linear-gradient(90deg, #ef4444 0%, #f97316 25%, #94a3b8 50%, #38bdf8 75%, #a78bfa 100%)",
              }}
            />
            <div
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0b0e14]"
              style={{
                left: `${moodPct}%`,
                backgroundColor: mood.color,
                boxShadow: `0 0 12px ${mood.color}88`,
              }}
              aria-hidden
            />
          </div>
          {marketState?.headline ? (
            <p className="m-0 mt-1.5 text-[10px] leading-snug text-slate-500">{marketState.headline}</p>
          ) : null}
        </div>
      </section>

      <div>
        <SectionLabel title="핵심 패닉지수" variant="core" />
        <section className="trading-card-shell overflow-hidden border border-white/[0.1] p-px shadow-[0_0_28px_rgba(0,0,0,0.45)]">
          <div className="grid grid-cols-2 gap-px bg-white/[0.07] sm:grid-cols-3 lg:grid-cols-5">
            {CORE_METRICS.map((metric) => (
              <MetricTile
                key={metric.key}
                metric={metric}
                value={fmt(metric.key, panicData?.[metric.key])}
                selected={chartMetric === metric.key}
                onSelect={() => setChartMetric(metric.key)}
                variant="core"
              />
            ))}
            <div
              className={[
                CORE_CELL,
                "col-span-2 border-t border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent sm:col-span-1 sm:border-t-0 sm:border-l sm:border-white/[0.08]",
              ].join(" ")}
              aria-label="패닉 종합 점수"
            >
              <span className={CORE_LABEL}>패닉지수</span>
              <span className={CORE_VALUE} style={metricValueDisplayStyle("#e2e8f0")}>
                {finalScore != null ? finalScore : "—"}
              </span>
            </div>
          </div>
        </section>

        <SectionLabel title="전문가 리스크 지표" variant="expert" />
        <section className="mb-5 overflow-hidden rounded-md border border-white/[0.03] bg-[rgba(255,255,255,0.015)] p-px opacity-[0.78]">
          <div className="grid grid-cols-2 gap-px bg-white/[0.025] sm:grid-cols-3 lg:grid-cols-5">
            {EXPERT_METRICS.map((metric) => (
              <MetricTile
                key={metric.key}
                metric={metric}
                value={fmt(metric.key, panicData?.[metric.key])}
                selected={chartMetric === metric.key}
                onSelect={() => setChartMetric(metric.key)}
                variant="expert"
              />
            ))}
          </div>
        </section>
      </div>

      <section className="grid grid-cols-1 gap-1 sm:grid-cols-3 sm:gap-1.5">
        {horizons.map((h) => (
          <article key={h.id} className={`rounded-lg border px-2 py-1.5 ${h.accent}`}>
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[8px] font-bold tracking-[0.14em] text-slate-500">{h.tag}</span>
              {h.score != null ? (
                <span className="font-mono text-[9px] tabular-nums text-slate-500">{h.score}</span>
              ) : null}
            </div>
            <p className="m-0 mt-0.5 line-clamp-1 text-[11px] font-semibold leading-tight text-slate-100">{h.title}</p>
            <p className="m-0 mt-0.5 line-clamp-2 text-[9px] leading-snug text-slate-500">{h.body}</p>
          </article>
        ))}
      </section>

      <PanicDeskChart
        className="mt-3"
        rows={cycleMetricHistory}
        primarySeries={chartSeries}
        chartMetric={chartMetric}
        panicData={panicData}
        deskMarketReport={deskMarketReport}
        deskMarketReportLoading={deskMarketReportLoading}
      />
    </div>
  )
}
