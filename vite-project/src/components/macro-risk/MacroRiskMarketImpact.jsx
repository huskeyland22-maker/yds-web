const STANCE_CLASS = {
  risk: "border-rose-500/25 bg-rose-500/[0.08] text-rose-100",
  neutral: "border-amber-500/25 bg-amber-500/[0.08] text-amber-100",
  favorable: "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-100",
}

/**
 * @param {{ rows: import("../../macro-risk/marketImpact.js").MarketImpactRow[] }} props
 */
export default function MacroRiskMarketImpact({ rows }) {
  if (!rows?.length) return null

  return (
    <section className="trading-card-shell px-3 py-2.5 sm:px-3.5 sm:py-3">
      <p className="m-0 text-[10px] font-semibold tracking-[0.12em] text-slate-500">시장 영향</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {rows.map((r) => (
          <span
            key={r.id}
            className={[
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold",
              STANCE_CLASS[r.stance] ?? STANCE_CLASS.neutral,
            ].join(" ")}
          >
            {r.label}
            <span aria-hidden>{r.emoji}</span>
          </span>
        ))}
      </div>
      <p className="m-0 mt-2 text-[9px] text-slate-600">위험 🔴 · 중립 🟠 · 우호 🟢</p>
    </section>
  )
}
