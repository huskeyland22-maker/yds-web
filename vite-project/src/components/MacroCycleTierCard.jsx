import { useEffect } from "react"
import { motion } from "framer-motion"
import MacroCycleLwChart from "./MacroCycleLwChart.jsx"
import { CycleHistoryTraceBadge } from "./DataTraceBadge.jsx"
import { logComponentDataSource } from "../utils/dataFlowTrace.js"
import {
  formatMetricValue,
  metricValueDisplayStyle,
  pctDelta,
  pickMetricDisplayValue,
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
  tactical: "shadow-trading-card md:hover:shadow-trading-card-hover",
  strategic: "shadow-trading-card md:hover:shadow-trading-card-hover",
  macro: "shadow-trading-card md:hover:shadow-trading-card-hover",
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
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[9px] font-semibold tracking-wide ${cls}`}
    >
      {label}
    </span>
  )
}

function MetricBlock({ series, panicData, rows, large }) {
  const v = pickMetricDisplayValue(panicData, rows, series.key)
  const pct = pctDelta(rows, series.key)
  const name = series.name ?? series.key
  const hasDelta = pct != null && Number.isFinite(pct)
  const finite = Number.isFinite(v)
  const accent = finite ? resolveSeriesColor(series) : "#94a3b8"
  const valueStyle = finite ? metricValueDisplayStyle(accent) : { color: "#94a3b8", textShadow: "0 1px 0 rgba(0,0,0,0.85)" }
  const valueSize = large
    ? "text-[clamp(1.75rem,6.5vw,2.65rem)] leading-[0.92] sm:text-[clamp(1.9rem,4.2vw,3rem)]"
    : "text-[clamp(1.25rem,4.8vw,1.85rem)] leading-[0.92] sm:text-[clamp(1.4rem,2.8vw,2.1rem)]"

  return (
    <div
      className={`relative flex min-w-0 flex-col ${large ? "min-h-[5rem] px-1 sm:min-h-[5.75rem]" : "min-h-[4.25rem] px-0.5 sm:min-h-[5rem]"}`}
    >
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p
          className={`m-0 max-w-full min-w-0 break-words font-mono font-extrabold tabular-nums tracking-tight ${valueSize}`}
          style={valueStyle}
        >
          {formatMetricValue(series.key, v)}
        </p>
        <p className="m-0 mt-1 max-w-[18ch] text-trading-2xs font-semibold uppercase leading-tight tracking-[0.16em] text-slate-500 sm:mt-2 sm:text-trading-xs">
          {name}
        </p>
      </div>

      <div className="pointer-events-none absolute bottom-0 right-0 flex translate-y-px items-baseline gap-0.5 font-mono tabular-nums">
        {hasDelta ? (
          <>
            <span className={`text-[9px] sm:text-[10px] ${pct >= 0 ? "text-emerald-500/50" : "text-rose-500/50"}`}>
              {pct >= 0 ? "▲" : "▼"}
            </span>
            <span className="text-[9px] font-medium text-slate-500/75 sm:text-[10px]">
              {pct >= 0 ? "+" : ""}
              {pct.toFixed(1)}%
            </span>
          </>
        ) : (
          <span className="text-[9px] text-slate-600/80 sm:text-[10px]">Δ —</span>
        )}
      </div>
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
 *   historySourceLine?: string
 *   compact?: boolean
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
  feedLabel = "확정",
  asOfDateLabel = "—",
  updatedLine = "—",
  sourceLine = "데이터 기준 · 확정 종가",
  historySourceLine = "",
  compact = false,
}) {
  useEffect(() => {
    logComponentDataSource(`MacroCycleTierCard:${tier}`, {
      source: historySourceLine || sourceLine,
      rowCount: Array.isArray(rows) ? rows.length : 0,
      hasPanic: Boolean(panicData),
      feedKind,
    })
  }, [tier, historySourceLine, sourceLine, rows, panicData, feedKind])

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
      whileHover={compact ? undefined : { y: -1 }}
      className="rounded-card-lg p-px [background:linear-gradient(135deg,rgba(255,255,255,0.06)_0%,rgba(15,23,42,0.35)_45%,rgba(15,23,42,0.12)_100%)]"
    >
      <div
        className={`relative overflow-hidden rounded-card bg-[#060910] transition-[box-shadow,ring-color] duration-300 ease-out md:hover:shadow-trading-card-hover md:hover:ring-1 md:hover:ring-cyan-400/10 ${borderGlow}`}
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

          <header className={`border-b border-white/[0.05] ${compact ? "px-2.5 pb-2 pt-2" : "px-3 pb-3 pt-3 sm:px-4 sm:pb-3.5 sm:pt-3.5"}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="m-0 text-trading-2xs font-bold tracking-[0.08em] text-slate-500">{tierLabel}</p>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <FeedStatusBadge kind={feedKind} label={feedLabel} />
                <p className="m-0 max-w-[10rem] text-right text-trading-2xs font-medium tracking-wide text-slate-400">{statusLabel}</p>
              </div>
            </div>

            <h2
              className={
                compact
                  ? "m-0 mt-1.5 text-[14px] font-semibold leading-tight text-slate-50"
                  : "m-0 mt-2.5 text-trading-lg font-semibold leading-tight tracking-tight text-slate-50 sm:mt-3 sm:text-trading-xl"
              }
            >
              {state}
            </h2>

            <div className="mt-2 space-y-0.5 border-l-2 border-white/[0.1] pl-2.5 sm:mt-2.5">
              <p className="m-0 text-trading-sm font-semibold leading-snug text-slate-200/95 sm:text-trading-base">{subtitlePrimary}</p>
              {subtitleSecondary ? (
                <p className="m-0 text-trading-xs leading-snug text-slate-600 sm:text-trading-sm">{subtitleSecondary}</p>
              ) : null}
            </div>
          </header>

          <section className={`border-b border-white/[0.05] ${compact ? "px-2.5 py-2" : "px-3 py-3 sm:px-4 sm:py-3.5"}`}>
            <p className="m-0 text-trading-2xs font-semibold tracking-[0.1em] text-slate-500">핵심 수치</p>
            {primaryS ? (
              <div className="mt-2 rounded-lg border border-white/[0.07] bg-gradient-to-b from-black/35 to-black/[0.18] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-4 sm:py-4">
                <MetricBlock series={primaryS} panicData={panicData} rows={rows} large />
              </div>
            ) : null}
            {restSeries.length ? (
              <div
                className={`mt-2 grid gap-2 sm:gap-3 ${restSeries.length >= 2 ? "grid-cols-2" : "grid-cols-1"}`}
              >
                {restSeries.map((s) => (
                  <div
                    key={s.key}
                    className="rounded-lg border border-white/[0.05] bg-gradient-to-b from-black/30 to-black/[0.14] px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:px-2.5 sm:py-2.5"
                  >
                    <MetricBlock series={s} panicData={panicData} rows={rows} large={false} />
                  </div>
                ))}
              </div>
            ) : null}

            {!compact ? (
              <p className="m-0 mt-2 border-t border-white/[0.04] pt-2 font-mono text-trading-2xs leading-relaxed text-slate-700">
                <span className="text-slate-600">기준일 {asOfDateLabel}</span>
                <span className="mx-1.5 text-slate-800">·</span>
                <span>{updatedLine}</span>
              </p>
            ) : null}
          </section>

          {!compact ? (
            <section className="px-2.5 pb-1 pt-2 sm:px-3">
              <p className="m-0 mb-1.5 px-1 text-trading-2xs font-semibold tracking-[0.1em] text-slate-500">일별 흐름</p>
              {primaryS ? <MacroCycleLwChart rows={rows} primarySeries={primaryS} /> : null}
            </section>
          ) : null}

          {!compact ? (
            <footer className="border-t border-white/[0.05] px-3 py-3 sm:px-4 sm:py-3.5">
              <CycleHistoryTraceBadge className="mb-2" />
              <p className="m-0 text-trading-2xs font-semibold tracking-[0.1em] text-slate-500">데스크 코멘트</p>
              <div className="m-0 mt-1.5 space-y-1">
                {(macroComments.length ? macroComments : ["실제 데이터 없음"]).slice(0, 2).map((line) => (
                  <p key={line} className="m-0 text-trading-xs leading-snug text-slate-500 sm:text-trading-sm">
                    {line}
                  </p>
                ))}
              </div>
            </footer>
          ) : null}
        </div>
      </div>
    </motion.article>
  )
}
