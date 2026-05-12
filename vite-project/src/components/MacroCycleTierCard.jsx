import { motion } from "framer-motion"
import MacroCycleChart from "./MacroCycleChart.jsx"
import { formatMetricValue, pctDelta, resolveSeriesColor } from "./macroCycleChartUtils.js"

const ACCENT_RING = {
  tactical: "from-amber-500/[0.12] via-slate-500/[0.06] to-slate-900/0",
  strategic: "from-slate-400/[0.1] via-indigo-500/[0.08] to-slate-900/0",
  macro: "from-emerald-500/[0.1] via-slate-500/[0.05] to-slate-900/0",
}

const STATUS_DOT = {
  stable: "bg-emerald-500/80 shadow-[0_0_10px_rgba(52,211,153,0.35)]",
  watch: "bg-amber-500/80 shadow-[0_0_10px_rgba(251,191,36,0.3)]",
  stress: "bg-rose-500/75 shadow-[0_0_10px_rgba(251,113,133,0.35)]",
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
 *   resolveInsight: (key: string, raw: unknown) => string
 *   statusVariant?: keyof typeof STATUS_DOT
 *   statusLabel: string
 *   macroComments: string[]
 *   delay?: number
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
  resolveInsight,
  statusVariant = "stable",
  statusLabel,
  macroComments,
  delay = 0,
}) {
  const ring = ACCENT_RING[tier] ?? ACCENT_RING.tactical
  const dotCls = STATUS_DOT[statusVariant] ?? STATUS_DOT.stable

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-xl bg-gradient-to-br p-px ${ring}`}
    >
      <div className="rounded-[11px] bg-[#080c12] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_42px_rgba(0,0,0,0.42)] transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_26px_56px_rgba(0,0,0,0.5)]">
        <div className="border-b border-white/[0.04] px-4 pb-3 pt-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotCls}`} title={statusLabel} />
                <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {tierLabel}
                  <span className="ml-2 font-normal normal-case tracking-normal text-slate-400">· {statusLabel}</span>
                </p>
              </div>
              <p className="m-0 mt-2 text-[15px] font-semibold leading-snug tracking-tight text-slate-100">{state}</p>
              <p className="m-0 mt-1 text-[13px] leading-relaxed text-slate-400">{action}</p>
              {hint ? <p className="m-0 mt-2 text-[11px] leading-relaxed text-slate-500">{hint}</p> : null}
            </div>
            <div className="shrink-0 text-right">
              {series.map((s) => {
                const raw = panicData?.[s.key]
                const v = Number(raw)
                const pct = pctDelta(rows, s.key)
                const c = resolveSeriesColor(s)
                return (
                  <div key={s.key} className="mb-2 last:mb-0">
                    <p className="m-0 text-[9px] font-medium uppercase tracking-wider text-slate-500">{s.name}</p>
                    <p className="m-0 font-mono text-sm font-semibold tabular-nums text-slate-100">
                      <span style={{ color: c }}>{formatMetricValue(s.key, v)}</span>
                      {pct != null && Number.isFinite(pct) ? (
                        <span
                          className={`ml-1.5 text-[11px] font-medium ${pct >= 0 ? "text-emerald-500/90" : "text-rose-400/90"}`}
                        >
                          {pct >= 0 ? "+" : ""}
                          {pct.toFixed(1)}%
                        </span>
                      ) : null}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="px-2 pb-1 pt-2 sm:px-3">
          <MacroCycleChart rows={rows} series={series} resolveInsight={resolveInsight} />
        </div>

        <div className="border-t border-white/[0.04] px-4 py-3">
          <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">시장 해석</p>
          <ul className="m-0 mt-2 list-none space-y-1.5 p-0">
            {macroComments.map((line) => (
              <li key={line} className="relative pl-3 text-[12px] leading-relaxed text-slate-400 before:absolute before:left-0 before:top-[0.55em] before:h-px before:w-2 before:bg-slate-600">
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.article>
  )
}
