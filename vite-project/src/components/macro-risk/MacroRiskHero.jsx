/**
 * @param {{ snapshot: import("../../macro-risk/engine.js").MacroRiskSnapshot }} props
 */
export default function MacroRiskHero({ snapshot }) {
  return (
    <section className="macro-risk-hero trading-card-shell overflow-hidden px-3 py-3 sm:px-4 sm:py-4">
      <p className="m-0 text-[9px] font-semibold tracking-[0.18em] text-slate-500">MACRO RISK SCORE</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="m-0 text-[11px] font-medium text-slate-400">Macro Risk</p>
          <p className="m-0 font-mono text-[2rem] font-bold leading-none tabular-nums text-slate-50 sm:text-[2.25rem]">
            {snapshot.score}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-slate-300">
          {snapshot.pillarChips.map((p) => (
            <span key={p.key} className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1">
              {p.label} {p.emoji}
            </span>
          ))}
        </div>
      </div>
      <p className="m-0 mt-2 text-[13px] font-semibold text-slate-100">{snapshot.headline}</p>
      <p className="m-0 mt-0.5 text-[12px] text-slate-400">{snapshot.subheadline}</p>
    </section>
  )
}
