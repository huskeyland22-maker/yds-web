const TONE_CLASS = {
  risk: "border-rose-500/25 bg-rose-500/[0.08] text-rose-100",
  neutral: "border-amber-500/25 bg-amber-500/[0.08] text-amber-100",
  favorable: "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-100",
}

/**
 * @param {{ rows: { key: string; label: string; active: boolean; tone: 'risk'|'neutral'|'favorable' }[] }} props
 */
export default function MacroRiskMarketRegime({ rows = [] }) {
  if (!rows.length) return null

  return (
    <section className="trading-card-shell px-3 py-2.5 sm:px-3.5 sm:py-3">
      <p className="m-0 text-[10px] font-semibold tracking-[0.12em] text-slate-500">MARKET REGIME</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {rows.map((r) => (
          <span
            key={r.key}
            className={[
              "rounded-md border px-2 py-1 text-[10px] font-semibold",
              r.active ? TONE_CLASS[r.tone] : "border-white/[0.08] bg-white/[0.02] text-slate-500",
            ].join(" ")}
          >
            {r.label}
          </span>
        ))}
      </div>
    </section>
  )
}
