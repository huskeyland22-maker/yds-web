/**
 * @param {{ triggers: import("../../macro-risk/triggers.js").ReturnType<import("../../macro-risk/triggers.js").evaluateCompositeTriggers> }} props
 */
export default function MacroRiskTriggers({ triggers }) {
  const active = triggers.filter((t) => t.active)
  const inactive = triggers.filter((t) => !t.active)

  return (
    <section className="macro-risk-triggers trading-card-shell px-3 py-2.5 sm:px-3.5 sm:py-3">
      <p className="m-0 text-[10px] font-semibold tracking-[0.12em] text-slate-500">복합 트리거</p>
      {active.length === 0 ? (
        <p className="m-0 mt-2 text-[11px] text-slate-500">활성 트리거 없음 — 단일 수치가 아닌 조합 조건으로 평가합니다.</p>
      ) : (
        <ul className="m-0 mt-2 list-none space-y-1.5 p-0">
          {active.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/25 bg-amber-500/[0.08] px-2.5 py-1.5 text-[12px] font-semibold text-amber-100"
            >
              <span>{t.label}</span>
              <span aria-hidden>{t.emoji}</span>
              {t.detail ? <span className="text-[10px] font-normal text-amber-200/70">{t.detail}</span> : null}
            </li>
          ))}
        </ul>
      )}
      {inactive.length > 0 ? (
        <p className="m-0 mt-2 text-[10px] text-slate-600">
          대기: {inactive.map((t) => t.label).join(" · ")}
        </p>
      ) : null}
    </section>
  )
}
