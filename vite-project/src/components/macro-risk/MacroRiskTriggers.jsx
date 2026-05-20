/**
 * @param {{ triggers: import("../../macro-risk/triggers.js").ReturnType<import("../../macro-risk/triggers.js").evaluateCompositeTriggers> }} props
 */
export default function MacroRiskTriggers({ triggers }) {
  const active = triggers.filter((t) => t.active)
  const inactive = triggers.filter((t) => !t.active)

  return (
    <section className="macro-risk-triggers trading-card-shell px-[18px] py-5 sm:px-6 sm:py-6">
      <p className="m-0 text-[10px] font-semibold tracking-[0.12em] text-slate-500">복합 트리거</p>
      {active.length === 0 ? (
        <p className="m-0 mt-4 text-[11px] leading-relaxed text-slate-500">
          활성 트리거 없음 — 단일 수치가 아닌 조합 조건으로 평가합니다.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-3">
          {active.map((t) => (
            <div
              key={t.id}
              className="flex max-w-full flex-col gap-1 rounded-xl border border-amber-500/30 bg-amber-500/[0.12] px-[18px] py-4 shadow-sm sm:max-w-[calc(50%-0.375rem)] lg:max-w-[calc(33.333%-0.667rem)]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] font-bold text-amber-50">{t.label}</span>
                <span className="text-base leading-none" aria-hidden>
                  {t.emoji}
                </span>
              </div>
              <span className="font-mono text-[10px] font-semibold text-amber-200/95">
                {Number(t.scoreAdd) >= 0 ? `score +${t.scoreAdd}` : `score ${t.scoreAdd}`}
              </span>
              {t.detail ? <p className="m-0 text-[10px] leading-snug text-amber-200/75">{t.detail}</p> : null}
            </div>
          ))}
        </div>
      )}
      {inactive.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
          <span className="w-full text-[10px] font-medium text-slate-600">대기</span>
          {inactive.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[10px] font-medium text-slate-500"
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
