import { formatMetricValue } from "./macroCycleChartUtils.js"

const CORE = [
  { key: "vix", label: "VIX", accent: "#f87171" },
  { key: "fearGreed", label: "Fear & Greed", accent: "#fbbf24" },
  { key: "putCall", label: "Put/Call", accent: "#60a5fa" },
  { key: "highYield", label: "HY OAS", accent: "#fb923c" },
]

function fmt(key, v) {
  if (v == null || !Number.isFinite(Number(v))) return "—"
  return formatMetricValue(key, Number(v))
}

export default function MobileCoreMetricsStrip({ panicData, updatedLine, isStale }) {
  return (
    <section
      className="trading-card-shell overflow-hidden"
      aria-label="핵심 시장 지표"
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-2.5 py-1.5">
        <p className="m-0 text-[10px] font-semibold tracking-[0.14em] text-slate-500">LIVE MARKETS</p>
        <p className="m-0 truncate font-mono text-[9px] text-slate-600">
          {isStale ? <span className="text-amber-400/90">STALE · </span> : null}
          {updatedLine ?? "—"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-px bg-white/[0.06] p-px">
        {CORE.map(({ key, label, accent }) => {
          const v = panicData?.[key]
          return (
            <div
              key={key}
              className="flex min-h-[3.25rem] flex-col justify-center bg-[#070a10] px-2 py-1.5"
            >
              <p
                className="m-0 font-mono text-[1.35rem] font-semibold leading-none tabular-nums tracking-tight"
                style={{ color: accent }}
              >
                {fmt(key, v)}
              </p>
              <p className="m-0 mt-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-slate-500">
                {label}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}