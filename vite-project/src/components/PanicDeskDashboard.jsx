import { useMemo, useState } from "react"
import { getFinalScore, getMidScore, getShortScore } from "../utils/tradingScores.js"
import { ageMsFromUpdatedAt, formatRelativeAgeEn } from "../utils/formatDataAge.js"
import { moodPositionPct, resolveMarketMood } from "../utils/panicDeskMood.js"
import { formatMetricValue } from "./macroCycleChartUtils.js"
import PanicDeskChart from "./PanicDeskChart.jsx"

const METRICS = [
  { key: "vix", label: "VIX", accent: "#f87171" },
  { key: "fearGreed", label: "F&G", accent: "#fbbf24" },
  { key: "putCall", label: "P/C", accent: "#60a5fa" },
  { key: "highYield", label: "HY OAS", accent: "#fb923c" },
  { key: "bofa", label: "BofA", accent: "#c084fc" },
]

const MOOD_LABELS = ["극도 공포", "공포", "중립", "과열", "극도 과열"]

const METRIC_CELL =
  "flex min-h-[3.25rem] flex-col items-center justify-center bg-[#070a10] px-0.5 py-1.5 transition sm:min-h-[3.5rem]"

function fmt(key, v) {
  if (v == null || !Number.isFinite(Number(v))) return "—"
  return formatMetricValue(key, Number(v))
}

function formatCollectedAtKst(updatedAt) {
  if (!updatedAt) return null
  const d = new Date(updatedAt)
  if (Number.isNaN(d.getTime())) return null
  const date = d.toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  const time = d.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  return `${date} ${time} KST`
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

  const staleAgeLabel = useMemo(() => formatRelativeAgeEn(dataAgeMs), [dataAgeMs])
  const collectedAtLabel = useMemo(() => formatCollectedAtKst(panicData?.updatedAt), [panicData?.updatedAt])
  const showStaleBadge = isStale || (dataAgeMs != null && dataAgeMs >= 4 * 60 * 60 * 1000)

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
    const m = METRICS.find((x) => x.key === chartMetric)
    return { key: chartMetric, name: m?.label ?? chartMetric, color: m?.accent ?? "#94a3b8" }
  }, [chartMetric])

  return (
    <div className="relative space-y-2 lg:space-y-2.5">
      <div className="sticky top-0 z-20 -mx-0.5 flex items-start justify-end gap-2 border-b border-white/[0.06] bg-[#0B0E14]/95 px-0.5 py-1.5 backdrop-blur-sm">
        <div className="text-right">
          <p className="m-0 text-[8px] font-semibold tracking-[0.14em] text-slate-600">마지막 수집</p>
          <p className="m-0 font-mono text-[10px] tabular-nums text-slate-300">
            {collectedAtLabel ?? "—"}
          </p>
          <p className="m-0 mt-0.5 font-mono text-[9px] text-slate-600">기준일 {asOfDateLabel}</p>
        </div>
        {showStaleBadge && staleAgeLabel ? (
          <span
            className="shrink-0 rounded-md border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-amber-200/95"
            title="데이터 갱신 지연"
          >
            STALE · {staleAgeLabel}
          </span>
        ) : null}
      </div>

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

      <section className="trading-card-shell overflow-x-auto p-px">
        <div className="grid min-w-[20.5rem] grid-cols-6 gap-px bg-white/[0.06] sm:min-w-0">
          {METRICS.map(({ key, label, accent }) => (
            <button
              key={key}
              type="button"
              onClick={() => setChartMetric(key)}
              className={[
                METRIC_CELL,
                chartMetric === key ? "ring-1 ring-inset ring-white/15" : "hover:bg-white/[0.03]",
              ].join(" ")}
            >
              <span
                className="font-mono text-[1rem] font-bold leading-none tabular-nums sm:text-[1.1rem]"
                style={{ color: accent }}
              >
                {fmt(key, panicData?.[key])}
              </span>
              <span className="mt-0.5 text-[8px] font-semibold tracking-[0.1em] text-slate-500">{label}</span>
            </button>
          ))}
          <div
            className={[
              METRIC_CELL,
              "border-l border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent",
            ].join(" ")}
            aria-label="패닉 종합 점수"
          >
            <span className="font-mono text-[1rem] font-bold leading-none tabular-nums text-slate-50 sm:text-[1.1rem]">
              {finalScore != null ? finalScore : "—"}
            </span>
            <span className="mt-0.5 text-[8px] font-semibold tracking-[0.1em] text-slate-500">패닉</span>
          </div>
        </div>
      </section>

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
        rows={cycleMetricHistory}
        primarySeries={chartSeries}
        chartMetric={chartMetric}
      />
    </div>
  )
}
