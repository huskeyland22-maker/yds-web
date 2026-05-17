import { useMemo, useState } from "react"
import { getAction, getFinalScore, getMidScore, getShortScore } from "../utils/tradingScores.js"
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

function fmt(key, v) {
  if (v == null || !Number.isFinite(Number(v))) return "—"
  return formatMetricValue(key, Number(v))
}

function scoreBarColor(score) {
  if (score >= 75) return "from-rose-500/80 to-rose-600/40"
  if (score >= 55) return "from-amber-500/70 to-orange-500/35"
  if (score >= 40) return "from-slate-400/50 to-slate-500/25"
  return "from-emerald-500/60 to-teal-500/30"
}

/**
 * @param {{
 *   panicData: object | null
 *   cycleMetricHistory: object[]
 *   isStale?: boolean
 *   updatedLine?: string
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
  updatedLine = "—",
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
  const action = finalScore != null ? getAction(finalScore) : "—"

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
    <div className="space-y-2 lg:space-y-3">
      <section className="trading-card-shell overflow-hidden px-2.5 py-2 sm:px-3 sm:py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="m-0 text-[9px] font-semibold tracking-[0.16em] text-slate-500">MARKET MOOD</p>
            <p className="m-0 mt-0.5 text-[15px] font-semibold tracking-tight text-slate-50 sm:text-base">
              {mood.active ? mood.label : "동기화 대기"}
            </p>
          </div>
          <div className="text-right">
            <p className="m-0 font-mono text-[9px] text-slate-600">{asOfDateLabel}</p>
            <p className="m-0 font-mono text-[9px] text-slate-500">
              {isStale ? <span className="text-amber-400/90">STALE · </span> : null}
              {updatedLine}
            </p>
          </div>
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

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_minmax(11rem,13rem)]">
        <section className="trading-card-shell overflow-hidden p-px">
          <div className="grid grid-cols-5 gap-px bg-white/[0.06]">
            {METRICS.map(({ key, label, accent }) => (
              <button
                key={key}
                type="button"
                onClick={() => setChartMetric(key)}
                className={[
                  "flex min-h-[3.5rem] flex-col items-center justify-center bg-[#070a10] px-0.5 py-1.5 transition sm:min-h-[3.75rem]",
                  chartMetric === key ? "ring-1 ring-inset ring-white/15" : "hover:bg-white/[0.03]",
                ].join(" ")}
              >
                <span
                  className="font-mono text-[1.05rem] font-bold leading-none tabular-nums sm:text-[1.15rem]"
                  style={{ color: accent }}
                >
                  {fmt(key, panicData?.[key])}
                </span>
                <span className="mt-0.5 text-[8px] font-semibold tracking-[0.1em] text-slate-500">{label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="trading-card-shell flex flex-row items-center gap-2 px-2.5 py-2 sm:flex-col sm:justify-center sm:py-2.5">
          <div className="min-w-0 flex-1 sm:w-full sm:text-center">
            <p className="m-0 text-[9px] font-semibold tracking-[0.14em] text-slate-500">패닉 종합</p>
            <p className="m-0 mt-0.5 font-mono text-[2rem] font-bold leading-none tabular-nums text-slate-50 sm:text-[2.25rem]">
              {finalScore != null ? finalScore : "—"}
            </p>
            <p className="m-0 mt-0.5 truncate text-[10px] font-medium text-slate-400">{action}</p>
          </div>
          <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-white/[0.06] sm:mt-1 sm:h-1 sm:w-full">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${scoreBarColor(finalScore ?? 50)}`}
              style={{ width: `${finalScore ?? 0}%` }}
            />
          </div>
          <div className="hidden gap-2 text-[9px] text-slate-500 sm:flex sm:w-full sm:justify-center">
            <span>단기 {shortScore ?? "—"}</span>
            <span className="text-slate-700">·</span>
            <span>중기 {midScore ?? "—"}</span>
          </div>
        </section>
      </div>

      <section className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 sm:gap-2">
        {horizons.map((h) => (
          <article key={h.id} className={`rounded-lg border px-2.5 py-2 ${h.accent}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-bold tracking-[0.14em] text-slate-500">{h.tag}</span>
              {h.score != null ? (
                <span className="font-mono text-[10px] tabular-nums text-slate-400">{h.score}</span>
              ) : null}
            </div>
            <p className="m-0 mt-1 text-[12px] font-semibold leading-tight text-slate-100">{h.title}</p>
            <p className="m-0 mt-0.5 text-[10px] leading-snug text-slate-500">{h.body}</p>
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
