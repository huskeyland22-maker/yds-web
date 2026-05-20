import { getTriggerShortLines, selectActiveTriggerCards, triggerSeverityTier } from "../../macro-risk/macroRiskDisplayTriggers.js"

const TIER_STYLE = {
  yellow: {
    shell: "border-amber-400/35 bg-amber-500/[0.1]",
    accent: "text-amber-100",
    sub: "text-amber-200/85",
  },
  orange: {
    shell: "border-orange-400/35 bg-orange-600/[0.12]",
    accent: "text-orange-50",
    sub: "text-orange-200/85",
  },
  red: {
    shell: "border-rose-500/35 bg-rose-600/[0.14]",
    accent: "text-rose-50",
    sub: "text-rose-200/85",
  },
}

/**
 * @param {{ triggers: Array<{ id: string; label: string; emoji?: string; active: boolean; detail?: string; scoreAdd: number }> }} props
 */
export default function MacroRiskTriggers({ triggers }) {
  const cards = selectActiveTriggerCards(triggers)
  const inactive = triggers.filter((t) => !t.active && t.id !== "long_rate_stress")

  return (
    <section className="trading-card-shell px-4 py-4">
      <p className="m-0 text-[9px] font-semibold tracking-[0.18em] text-slate-500">ACTIVE TRIGGERS</p>
      {cards.length === 0 ? (
        <p className="m-0 mt-2 text-[10px] leading-relaxed text-slate-500">활성 트리거 없음</p>
      ) : (
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {cards.map((t) => {
            const tier = triggerSeverityTier(t.scoreAdd)
            const cls = TIER_STYLE[tier]
            const label = t._cardLabel ?? t.label
            const icon = t._icon ?? t.emoji ?? "◎"
            const lines = getTriggerShortLines(t)
            return (
              <div
                key={t.id}
                className={["flex flex-col gap-0.5 rounded-lg border px-2.5 py-2 shadow-sm", cls.shell].join(" ")}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm leading-none text-slate-200" aria-hidden>
                    {icon}
                  </span>
                  <span className={`text-[11px] font-bold leading-tight ${cls.accent}`}>{label}</span>
                </div>
                {lines.map((line, i) => (
                  <p key={i} className={`m-0 font-mono text-[9px] leading-snug tabular-nums ${cls.sub}`}>
                    {line}
                  </p>
                ))}
              </div>
            )
          })}
        </div>
      )}
      {inactive.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/[0.06] pt-2">
          <span className="w-full text-[9px] font-medium text-slate-600">대기</span>
          {inactive.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 rounded border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[9px] font-medium text-slate-500"
            >
              {t.label}
              <span aria-hidden>{t.emoji}</span>
            </span>
          ))}
        </div>
      ) : null}
    </section>
  )
}
