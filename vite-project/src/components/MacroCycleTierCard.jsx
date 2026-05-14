import { motion } from "framer-motion"
import MacroCycleLwChart from "./MacroCycleLwChart.jsx"
import {
  formatMetricValue,
  pctDelta,
  pickPanicNumber,
  resolveSeriesColor,
} from "./macroCycleChartUtils.js"

const TIER_TOP_BAR = {
  tactical: "from-amber-500/90 via-amber-400/40 to-transparent",
  strategic: "from-indigo-400/85 via-violet-500/35 to-transparent",
  macro: "from-emerald-500/80 via-teal-500/30 to-transparent",
}

const TIER_RADIAL = {
  tactical: "radial-gradient(120% 80% at 10% 0%, rgba(245,158,11,0.14) 0%, transparent 55%)",
  strategic: "radial-gradient(120% 80% at 10% 0%, rgba(99,102,241,0.12) 0%, transparent 55%)",
  macro: "radial-gradient(120% 80% at 10% 0%, rgba(52,211,153,0.11) 0%, transparent 55%)",
}

const TIER_BORDER_GLOW = {
  tactical: "shadow-[0_0_0_1px_rgba(251,191,36,0.12),0_24px_64px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]",
  strategic: "shadow-[0_0_0_1px_rgba(129,140,248,0.12),0_24px_64px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]",
  macro: "shadow-[0_0_0_1px_rgba(52,211,153,0.1),0_24px_64px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]",
}

const FEED_BADGE = {
  live: "border-emerald-500/35 bg-emerald-500/[0.12] text-emerald-200/95",
  confirmed: "border-sky-500/25 bg-sky-500/[0.08] text-sky-200/90",
  delayed: "border-amber-500/35 bg-amber-500/[0.1] text-amber-200/95",
}

const NOISE_BG =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")"

function FeedStatusBadge({ kind, label }) {
  const cls = FEED_BADGE[kind] ?? FEED_BADGE.confirmed
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] ${cls}`}
    >
      {label}
    </span>
  )
}

function MetricBlock({ series, panicData, rows, large }) {
  const v = pickPanicNumber(panicData, series.key)
  const pct = pctDelta(rows, series.key)
  const c = resolveSeriesColor(series)
  const name = series.name ?? series.key

  return (
    <div className={large ? "min-w-0" : ""}>
      <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{name}</p>
      <p
        className={`m-0 mt-1 font-mono font-semibold tabular-nums tracking-tight text-slate-50 ${large ? "text-[2.35rem] leading-none sm:text-[2.6rem]" : "text-xl sm:text-2xl"}`}
        style={{ color: c }}
      >
        {formatMetricValue(series.key, v)}
      </p>
      {pct != null && Number.isFinite(pct) ? (
        <p className={`m-0 mt-1 text-sm font-semibold tabular-nums ${pct >= 0 ? "text-emerald-400/95" : "text-rose-400/95"}`}>
          {pct >= 0 ? "+" : ""}
          {pct.toFixed(1)}%
        </p>
      ) : (
        <p className="m-0 mt-1 text-xs text-slate-600">—</p>
      )}
    </div>
  )
}

/**
 * @param {{
 *   tier: 'tactical'|'strategic'|'macro'
 *   tierLabel: string
 *   state: string
 *   action: string
 *   hint?: string
 *   series: { key: string; name?: string; color?: string }[]
 *   rows: object[]
 *   panicData: object | null
 *   statusVariant?: 'stable'|'watch'|'stress'
 *   statusLabel: string
 *   macroComments: string[]
 *   delay?: number
 *   feedKind?: 'live'|'confirmed'|'delayed'
 *   feedLabel?: string
 *   asOfDateLabel?: string
 *   updatedLine?: string
 *   sourceLine?: string
 * }} props
 */
export default function MacroCycleTierCard({
  tier,
  tierLabel,
  state,
  action,
  hint,
  series,
  rows,
  panicData,
  statusVariant: _statusVariant,
  statusLabel,
  macroComments,
  delay = 0,
  feedKind = "confirmed",
  feedLabel = "CONFIRMED",
  asOfDateLabel = "—",
  updatedLine = "—",
  sourceLine = "Source: Confirmed Close",
}) {
  const topBar = TIER_TOP_BAR[tier] ?? TIER_TOP_BAR.tactical
  const radial = TIER_RADIAL[tier] ?? TIER_RADIAL.tactical
  const borderGlow = TIER_BORDER_GLOW[tier] ?? TIER_BORDER_GLOW.tactical
  const [primaryS, ...restSeries] = series
  const subtitlePrimary = action
  const subtitleSecondary = macroComments[0] ?? hint ?? null

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      className="rounded-xl p-px [background:linear-gradient(135deg,rgba(255,255,255,0.07)_0%,rgba(15,23,42,0.4)_45%,rgba(15,23,42,0.15)_100%)]"
    >
      <div
        className={`relative overflow-hidden rounded-[11px] bg-[#060910] transition-[box-shadow,transform] duration-300 ease-out hover:shadow-[0_28px_72px_rgba(0,0,0,0.58)] ${borderGlow}`}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-overlay"
          style={{ backgroundImage: NOISE_BG, backgroundSize: "180px 180px" }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `${radial}, linear-gradient(165deg, rgba(15,23,42,0.5) 0%, rgba(6,9,16,0.98) 48%, rgba(4,6,12,1) 100%)`,
          }}
          aria-hidden
        />

        <div className="relative z-[1]">
          <div className={`h-[3px] w-full bg-gradient-to-r ${topBar}`} aria-hidden />

          <header className="border-b border-white/[0.05] px-5 pb-4 pt-4">
            <div className="flex items-start justify-between gap-3">
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{tierLabel}</p>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <FeedStatusBadge kind={feedKind} label={feedLabel} />
                <p className="m-0 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">{statusLabel}</p>
              </div>
            </div>

            <h2 className="m-0 mt-4 text-[1.45rem] font-semibold leading-[1.15] tracking-tight text-slate-50 sm:text-[1.65rem]">
              {state}
            </h2>

            <div className="mt-3 space-y-1 border-l-2 border-white/[0.1] pl-3">
              <p className="m-0 text-[13px] font-semibold leading-snug text-slate-200/95 sm:text-sm">{subtitlePrimary}</p>
              {subtitleSecondary ? (
                <p className="m-0 text-[11.5px] leading-relaxed text-slate-600 sm:text-[12px]">{subtitleSecondary}</p>
              ) : null}
            </div>
          </header>

          <section className="border-b border-white/[0.05] px-5 py-4">
            <p className="m-0 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">핵심 수치</p>
            {primaryS ? (
              <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/25 px-4 py-3">
                <MetricBlock series={primaryS} panicData={panicData} rows={rows} large />
              </div>
            ) : null}
            {restSeries.length ? (
              <div
                className={`mt-3 grid gap-4 ${restSeries.length >= 2 ? "grid-cols-2" : "grid-cols-1"}`}
              >
                {restSeries.map((s) => (
                  <div key={s.key} className="rounded-lg border border-white/[0.04] bg-black/20 px-3 py-2.5">
                    <MetricBlock series={s} panicData={panicData} rows={rows} large={false} />
                  </div>
                ))}
              </div>
            ) : null}

            <p className="m-0 mt-3 border-t border-white/[0.04] pt-2.5 font-mono text-[8px] leading-relaxed text-slate-700">
              <span className="text-slate-600">As of {asOfDateLabel}</span>
              <span className="mx-1.5 text-slate-800">·</span>
              <span>{updatedLine}</span>
              <span className="mx-1.5 text-slate-800">·</span>
              <span>{sourceLine}</span>
            </p>
          </section>

          <section className="px-3 pb-1 pt-3 sm:px-4">
            <p className="m-0 mb-2 px-2 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">시계열</p>
            {primaryS ? <MacroCycleLwChart rows={rows} primarySeries={primaryS} /> : null}
          </section>

          <footer className="border-t border-white/[0.05] px-5 py-4">
            <p className="m-0 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">하단 해석</p>
            <ul className="m-0 mt-2.5 list-none space-y-2 p-0">
              {macroComments.map((line) => (
                <li
                  key={line}
                  className="relative pl-3.5 text-[12px] leading-relaxed text-slate-400 before:absolute before:left-0 before:top-[0.55em] before:h-px before:w-2.5 before:bg-slate-600"
                >
                  {line}
                </li>
              ))}
            </ul>
          </footer>
        </div>
      </div>
    </motion.article>
  )
}
