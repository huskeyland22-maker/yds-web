import { getTriggerShortLines, selectActiveTriggerCards, triggerSeverityTier } from "../../macro-risk/macroRiskDisplayTriggers.js"

const PRIORITY_MARK = ["①", "②", "③"]

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

  return (
    <section className="trading-card-shell px-4 py-3">
      <p className="m-0 text-[9px] font-semibold tracking-[0.18em] text-slate-500">ACTIVE TRIGGERS</p>
      {cards.length === 0 ? (
        <p className="m-0 mt-2 text-[10px] text-slate-500">활성 트리거 없음</p>
      ) : (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {cards.map((t, idx) => {
            const tier = triggerSeverityTier(t.scoreAdd)
            const cls = TIER_STYLE[tier]
            const label = t._cardLabel ?? t.label
            const lines = getTriggerShortLines(t)
            const mark = PRIORITY_MARK[idx] ?? `${idx + 1}`
            return (
              <div
                key={t.id}
                className={["flex flex-col gap-0.5 rounded-lg border px-2.5 py-2", cls.shell].join(" ")}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`text-[12px] font-bold tabular-nums ${cls.accent}`}>{mark}</span>
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
    </section>
  )
}
