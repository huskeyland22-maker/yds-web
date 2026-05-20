import { selectActiveTriggerCards, triggerSeverityTier } from "../../macro-risk/macroRiskDisplayTriggers.js"

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
    <section className="trading-card-shell px-3 py-3 sm:px-4 sm:py-3.5">
      <p className="m-0 text-[9px] font-semibold tracking-[0.18em] text-slate-500">ACTIVE TRIGGERS</p>
      <p className="m-0 mt-0.5 text-[10px] text-slate-500">최대 3 · 조합 신호 우선</p>
      {cards.length === 0 ? (
        <p className="m-0 mt-3 text-[11px] leading-relaxed text-slate-500">
          활성 트리거 없음 — 조합 조건이 충족되면 카드가 표시됩니다.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {cards.map((t) => {
            const tier = triggerSeverityTier(t.scoreAdd)
            const cls = TIER_STYLE[tier]
            const label = t._cardLabel ?? t.label
            const icon = t._icon ?? t.emoji ?? "◎"
            return (
              <div
                key={t.id}
                className={[
                  "flex min-h-[5.5rem] flex-col gap-1 rounded-xl border px-3 py-3 shadow-sm",
                  cls.shell,
                ].join(" ")}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg leading-none text-slate-200" aria-hidden>
                    {icon}
                  </span>
                  <span className={`text-[12px] font-bold ${cls.accent}`}>{label}</span>
                </div>
                <span className={`font-mono text-[10px] font-semibold ${cls.sub}`}>
                  {Number(t.scoreAdd) >= 0 ? `score +${t.scoreAdd}` : `score ${t.scoreAdd}`}
                </span>
                {t.detail ? (
                  <p className={`m-0 mt-1 line-clamp-4 text-[10px] leading-snug ${cls.sub}`}>{t.detail}</p>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
      {inactive.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
          <span className="w-full text-[10px] font-medium text-slate-600">대기 조건</span>
          {inactive.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-medium text-slate-500"
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
