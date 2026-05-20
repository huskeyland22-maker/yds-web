const WAIT_PILLS = [
  {
    id: "dollar_pressure",
    label: "위험자산 압박",
    emoji: "🔴",
    activeClass: "border-rose-500/50 bg-rose-600/20 text-rose-100 shadow-[0_0_12px_rgba(244,63,94,0.2)]",
    idleClass: "border-rose-500/20 bg-rose-950/30 text-rose-300/50",
  },
  {
    id: "liquidity_easing",
    label: "위험자산 우호",
    emoji: "🟢",
    activeClass: "border-emerald-500/50 bg-emerald-600/20 text-emerald-100 shadow-[0_0_12px_rgba(52,211,153,0.2)]",
    idleClass: "border-emerald-500/20 bg-emerald-950/30 text-emerald-300/50",
  },
]

/**
 * @param {{ triggers: Array<{ id: string; label: string; active: boolean; emoji?: string }> }} props
 */
export default function MacroRiskWaitSignal({ triggers }) {
  const byId = Object.fromEntries(triggers.map((t) => [t.id, t]))

  return (
    <section className="trading-card-shell px-4 py-3">
      <p className="m-0 text-[9px] font-semibold tracking-[0.18em] text-slate-500">WAIT SIGNAL</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        {WAIT_PILLS.map((pill) => {
          const t = byId[pill.id]
          const on = Boolean(t?.active)
          return (
            <div
              key={pill.id}
              className={[
                "flex min-h-[2.25rem] flex-1 items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors",
                on ? pill.activeClass : pill.idleClass,
              ].join(" ")}
              role="status"
              aria-pressed={on}
            >
              <span className="text-[11px] font-bold leading-tight">
                {pill.emoji} {pill.label}
              </span>
              <span
                className={[
                  "shrink-0 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide",
                  on ? "bg-white/15 text-white" : "bg-black/30 text-slate-500",
                ].join(" ")}
              >
                {on ? "ON" : "대기"}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
